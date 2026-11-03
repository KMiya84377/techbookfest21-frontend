"""モデルを呼ぶ前に、Jev で、CopilotKit の表示先(UI)を推奨する"""

from __future__ import annotations

import asyncio
import json
import logging
import math
import sys
from typing import Any

from strands.interventions import InterventionHandler, Proceed

from chat.jev_client import JevClient, JevUnavailable


logger = logging.getLogger(__name__)

# 判定ごとに、JSON を 1 行、標準出力に出す。CloudWatch Logs Insights で、
# 結果ごとに数えられる(例: `stats count(*) by outcome`)
decision_logger = logging.getLogger("jev_ui_router.decision")
if not decision_logger.handlers:
    _handler = logging.StreamHandler(sys.stdout)
    _handler.setFormatter(logging.Formatter("%(message)s"))
    decision_logger.addHandler(_handler)
    decision_logger.setLevel(logging.INFO)
    decision_logger.propagate = False

# 表示先の定義は、ここだけ。Jev の選択肢、候補の絞り込み、システムプロンプトの一覧を、これから作る
UI_DESTINATIONS = {
    "show_choices": "確認や質問のため、候補から選ぶボタンをチャットに表示する",
    "show_quiz": "クエスト内容の理解度チェックをチャット内に表示する",
    "update_quest_filter": "クエストボードの検索条件を変更する",
    "update_quest_detail": "A2UIで構成した比較・影響・補足のUIをチャットとニュースの詳細画面へ表示する(詳細を開いているときだけ)",
    "generate_a2ui": "A2UIのカタログに沿った構造化UIをチャット内に表示する",
    "generateSandboxedUi": "既存のUIでは表現しにくい図表や専用の可視化を生成する",
}
DETAIL_TOOLS = {"update_quest_detail"}
UI_TOOLS = set(UI_DESTINATIONS)
NO_UI = "none"
NO_UI_DESCRIPTION = "専用UIは不要で、通常のテキストで回答する"

# Web アプリは、詳細を開いているクエストの context の先頭に、この目印を付ける
# (webapp/src/components/generative-ui/GenerativeUI.tsx。両方を合わせる)
OPENED_QUEST_CONTEXT_MARKER = "[opened_quest]"

# invocation_state のキー。推奨は、1 回の実行につき 1 度だけ求め、
# モデルを呼んでいる間だけ、システムプロンプトに足す
_HINT_KEY = "jev_ui_router_hint"
_BASE_PROMPT_KEY = "jev_ui_router_base_prompt"


def ui_destinations_prompt() -> str:
    """システムプロンプトに入れる、表示先の一覧"""
    lines = ["# 表示先(UI)の一覧"]
    lines += [f"- {name}: {description}" for name, description in UI_DESTINATIONS.items()]
    return "\n".join(lines)


def _log_decision(
    outcome: str,
    candidates: list[str],
    selected: str | None = None,
    confidence: float | None = None,
) -> None:
    decision_logger.info(
        json.dumps(
            {
                "event": "jev_ui_route",
                "outcome": outcome,
                "candidates": candidates,
                "selected": selected,
                "confidence": confidence,
            },
            ensure_ascii=False,
        )
    )


def _render_messages(messages: list[dict[str, Any]], limit: int = 6) -> str:
    """直近のテキストだけを残す(ツールのデータや、履歴の全体を Jev に送らない)"""
    lines: list[str] = []
    for message in messages[-limit:]:
        role = message.get("role", "unknown")
        for block in message.get("content", []):
            if isinstance(block, dict) and isinstance(block.get("text"), str):
                lines.append(f"{role}: {block['text'][:1000]}")
    return "\n".join(lines) or "(会話履歴なし)"


def _detail_opened(agent) -> bool:
    """Web アプリが、AG-UI の context で、詳細を開いていると伝えたか"""
    state = getattr(agent, "state", None)
    context = state.get("agui_context") if state is not None else None
    if not isinstance(context, list):
        return False
    for entry in context:
        if not isinstance(entry, dict):
            continue
        description = entry.get("description")
        if isinstance(description, str) and description.startswith(OPENED_QUEST_CONTEXT_MARKER):
            value = entry.get("value")
            return value not in (None, "null", "")
    return False


def _candidates(agent) -> list[str]:
    """この依頼で、実際に使える表示先(コードで決める)"""
    names = getattr(agent, "tool_names", None)
    available = set(names) if isinstance(names, (list, set, tuple)) else set()
    candidates = [name for name in UI_DESTINATIONS if name in available]
    if not _detail_opened(agent):
        candidates = [name for name in candidates if name not in DETAIL_TOOLS]
    return candidates


def _hint_for(selected: str) -> str:
    if selected == NO_UI:
        recommendation = f"専用の表示は使わず、通常のテキストで回答すること({NO_UI_DESCRIPTION})"
    else:
        recommendation = f"{selected}({UI_DESTINATIONS[selected]})"
    return (
        "# 表示先の推奨(UIルーター)\n"
        f"この依頼には、{recommendation}が適していると判定されました。\n"
        "これは参考情報です。ユーザーが表示方法を明示している場合や、会話の流れに合わない場合は、"
        "そちらを優先してください。"
    )


class UiRouterIntervention(InterventionHandler):
    """モデルがツールを選ぶ前に、どの表示先が合うかを、Jev に聞く

    Jev は推奨するだけ。どのツールを呼ぶか、ツールの引数や UI の中身は、Strands Agent が決める
    """

    name = "jev-ui-router"

    def __init__(self, jev: JevClient, min_confidence: float = 0.5) -> None:
        if not 0.0 <= min_confidence <= 1.0:
            raise ValueError("min_confidence must be between 0 and 1")
        self.jev = jev
        self.min_confidence = min_confidence

    async def before_model_call(self, event, **kwargs):
        invocation_state = event.invocation_state
        if _HINT_KEY not in invocation_state:
            invocation_state[_HINT_KEY] = await self._recommend(event.agent)

        hint = invocation_state[_HINT_KEY]
        if hint:
            agent = event.agent
            base = invocation_state.setdefault(_BASE_PROMPT_KEY, agent.system_prompt)
            agent.system_prompt = f"{base}\n\n{hint}"
        return Proceed()

    async def after_model_call(self, event, **kwargs):
        # 推奨が、モデルの呼び出しの後に残らないよう、元のプロンプトに戻す
        base = event.invocation_state.get(_BASE_PROMPT_KEY)
        if base is not None:
            event.agent.system_prompt = base
        return Proceed()

    async def _recommend(self, agent) -> str:
        candidates = _candidates(agent)
        if not candidates:
            _log_decision("no_candidates", candidates)
            return ""

        state = json.dumps(
            {
                "recent_conversation": _render_messages(agent.messages),
                "screen": {"detail_opened": _detail_opened(agent)},
                "available_ui": candidates,
            },
            ensure_ascii=False,
        )
        choices = JevClient.choice(
            "ユーザーの依頼に最も適した表示先を1つ選んでください。",
            {
                **{name: UI_DESTINATIONS[name] for name in candidates},
                NO_UI: NO_UI_DESCRIPTION,
            },
        )

        try:
            # Jev のクライアントは HTTP で待つ。その間、イベントループを止めない
            answers = await asyncio.to_thread(self.jev.ask, state, {"best_ui": choices})
            decision = answers["best_ui"]
            selected = decision["choice"]
            confidence = float(decision["confidence"])
            if not math.isfinite(confidence) or not 0.0 <= confidence <= 1.0:
                raise ValueError("Jev returned confidence outside the 0-1 range")
            if selected not in {*candidates, NO_UI}:
                raise ValueError(f"Unexpected UI route: {selected}")
        except (JevUnavailable, KeyError, TypeError, ValueError) as error:
            # Jev が使えなくても、エージェントは推奨なしで動かす
            logger.warning("Jev UI routing unavailable; continuing without a hint: %s", error)
            _log_decision("fail_open", candidates)
            return ""

        if confidence < self.min_confidence:
            # 確信度が低いときは、モデルに任せる
            _log_decision("no_hint_low_confidence", candidates, selected, confidence)
            return ""

        outcome = "hinted_text" if selected == NO_UI else "hinted"
        _log_decision(outcome, candidates, selected, confidence)
        return _hint_for(selected)
