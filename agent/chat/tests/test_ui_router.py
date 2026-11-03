import asyncio
import json
import unittest
from types import SimpleNamespace
from unittest.mock import AsyncMock, MagicMock, patch

from bedrock_agentcore.identity.auth import IdentityClient
from bedrock_agentcore.runtime import BedrockAgentCoreContext
from chat.jev_client import JevClient, JevUnavailable
from strands.interventions import Proceed
from chat.ui_router import DETAIL_TOOLS, UiRouterIntervention


class JevClientTests(unittest.TestCase):
    def test_sends_authenticated_system_one_request(self):
        response = MagicMock()
        response.__enter__.return_value.read.return_value = b'{"answers":{"best_ui":{"choice":"show_quiz","confidence":0.9}}}'
        client = JevClient(api_key="test-key")

        with patch("urllib.request.urlopen", return_value=response) as urlopen:
            answers = client.ask("state", {"best_ui": JevClient.choice("choose", {"show_quiz": "quiz"})})

        request = urlopen.call_args.args[0]
        headers = {key.lower(): value for key, value in request.header_items()}
        body = json.loads(request.data)
        self.assertEqual(request.full_url, "https://api.typesafe.ai/v1/systemone")
        self.assertEqual(headers["authorization"], "Bearer test-key")
        self.assertEqual(body["model"], "jev-latest")
        self.assertEqual(answers["best_ui"]["choice"], "show_quiz")

    def test_rejects_invalid_response(self):
        response = MagicMock()
        response.__enter__.return_value.read.return_value = b'{"unexpected":true}'
        client = JevClient(api_key="test-key")

        with patch("urllib.request.urlopen", return_value=response):
            with self.assertRaises(JevUnavailable):
                client.ask("state", {})

    def test_uses_api_key_injected_by_agentcore_identity(self):
        response = MagicMock()
        response.__enter__.return_value.read.return_value = b'{"answers":{}}'
        client = JevClient(api_key_provider_name="typesafe-jev-api")
        BedrockAgentCoreContext.set_workload_access_token("test-workload-token")

        try:
            with patch.object(
                IdentityClient,
                "get_api_key",
                new=AsyncMock(return_value="identity-key"),
            ) as get_api_key:
                with patch("urllib.request.urlopen", return_value=response) as urlopen:
                    client.ask("state", {})
                get_api_key.assert_awaited_once_with(
                    provider_name="typesafe-jev-api",
                    agent_identity_token="test-workload-token",
                )
        finally:
            BedrockAgentCoreContext.set_workload_access_token(None)

        request = urlopen.call_args.args[0]
        headers = {key.lower(): value for key, value in request.header_items()}
        self.assertEqual(headers["authorization"], "Bearer identity-key")

    def test_wraps_identity_credential_errors(self):
        identity_error = RuntimeError("sensitive SDK detail")
        identity_error.response = {"Error": {"Code": "AccessDeniedException"}}

        def identity_decorator(*, provider_name):
            def decorate(function):
                def invoke(*args, **kwargs):
                    raise identity_error

                return invoke

            return decorate

        with patch("chat.jev_client.requires_api_key", side_effect=identity_decorator):
            client = JevClient(api_key_provider_name="typesafe-jev-api")

        with self.assertRaisesRegex(JevUnavailable, "AgentCore Identity") as error:
            client.ask("state", {})

        self.assertNotIn("sensitive SDK detail", str(error.exception))
        self.assertIn("AccessDeniedException", str(error.exception))


    def test_reuses_identity_key_until_ttl(self):
        response = MagicMock()
        response.__enter__.return_value.read.return_value = b'{"answers":{}}'
        client = JevClient(api_key_provider_name="typesafe-jev-api")
        BedrockAgentCoreContext.set_workload_access_token("test-workload-token")

        try:
            with patch.object(
                IdentityClient,
                "get_api_key",
                new=AsyncMock(return_value="identity-key"),
            ) as get_api_key:
                with patch("urllib.request.urlopen", return_value=response):
                    client.ask("state", {})
                    client.ask("state", {})
                get_api_key.assert_awaited_once()
        finally:
            BedrockAgentCoreContext.set_workload_access_token(None)


class FakeState:
    def __init__(self, values=None):
        self.values = values or {}

    def get(self, key=None):
        return self.values.get(key)


class UiRouterTests(unittest.TestCase):
    BASE_PROMPT = "base prompt"

    def setUp(self):
        self.agent = SimpleNamespace(
            messages=[{"role": "user", "content": [{"text": "理解度チェックを出して"}]}],
            tool_names=["fetch_news", "show_quiz", "show_choices", *sorted(DETAIL_TOOLS)],
            state=FakeState(),
            system_prompt=self.BASE_PROMPT,
        )
        self.invocation_state = {}

    def event(self):
        return SimpleNamespace(agent=self.agent, invocation_state=self.invocation_state)

    def before(self, jev):
        router = UiRouterIntervention(jev)
        result = asyncio.run(router.before_model_call(self.event()))
        return router, result

    def jev_choosing(self, choice, confidence=0.9):
        jev = MagicMock()
        jev.ask.return_value = {"best_ui": {"choice": choice, "confidence": confidence}}
        return jev

    def test_adds_hint_during_model_call_and_restores_it(self):
        router, result = self.before(self.jev_choosing("show_quiz"))

        self.assertIsInstance(result, Proceed)
        self.assertIn("show_quiz", self.agent.system_prompt)
        self.assertTrue(self.agent.system_prompt.startswith(self.BASE_PROMPT))

        asyncio.run(router.after_model_call(self.event()))
        self.assertEqual(self.agent.system_prompt, self.BASE_PROMPT)

    def test_asks_jev_once_per_invocation(self):
        jev = self.jev_choosing("show_quiz")
        router, _ = self.before(jev)
        asyncio.run(router.after_model_call(self.event()))
        asyncio.run(router.before_model_call(self.event()))

        jev.ask.assert_called_once()
        self.assertIn("show_quiz", self.agent.system_prompt)

    def test_no_hint_when_confidence_is_low(self):
        self.before(self.jev_choosing("show_choices", confidence=0.2))

        self.assertEqual(self.agent.system_prompt, self.BASE_PROMPT)

    def test_recommends_text_when_jev_selects_none(self):
        self.before(self.jev_choosing("none"))

        self.assertIn("通常のテキストで回答", self.agent.system_prompt)

    def test_excludes_detail_update_when_no_detail_is_open(self):
        jev = self.jev_choosing("show_quiz")
        self.before(jev)

        state = json.loads(jev.ask.call_args.args[0])
        criteria = jev.ask.call_args.args[1]["best_ui"]["criteria"]
        for name in DETAIL_TOOLS:
            self.assertNotIn(name, state["available_ui"])
            self.assertNotIn(name, criteria)
        self.assertFalse(state["screen"]["detail_opened"])

    def test_includes_detail_update_when_detail_is_open(self):
        self.agent.state = FakeState(
            {
                "agui_context": [
                    {"description": "[opened_quest] 詳細", "value": '{"id":"q1"}'},
                ]
            }
        )
        jev = self.jev_choosing("update_quest_detail")
        self.before(jev)

        state = json.loads(jev.ask.call_args.args[0])
        for name in DETAIL_TOOLS:
            self.assertIn(name, state["available_ui"])
        self.assertTrue(state["screen"]["detail_opened"])
        self.assertIn("update_quest_detail", self.agent.system_prompt)

    def test_treats_null_opened_quest_as_closed(self):
        self.agent.state = FakeState(
            {"agui_context": [{"description": "[opened_quest] 詳細", "value": "null"}]}
        )
        jev = self.jev_choosing("show_quiz")
        self.before(jev)

        state = json.loads(jev.ask.call_args.args[0])
        self.assertFalse(state["screen"]["detail_opened"])

    def test_does_not_send_tool_data_to_jev(self):
        self.agent.messages.append(
            {"role": "assistant", "content": [{"toolUse": {"name": "x", "input": {"secret": 1}}}]}
        )
        jev = self.jev_choosing("show_quiz")
        self.before(jev)

        self.assertNotIn("secret", jev.ask.call_args.args[0])

    def test_rejects_ui_outside_candidates(self):
        self.before(self.jev_choosing("generateSandboxedUi"))

        self.assertEqual(self.agent.system_prompt, self.BASE_PROMPT)

    def test_skips_jev_when_no_ui_is_available(self):
        self.agent.tool_names = ["fetch_news"]
        jev = MagicMock()
        self.before(jev)

        jev.ask.assert_not_called()
        self.assertEqual(self.agent.system_prompt, self.BASE_PROMPT)

    def test_fails_open_when_jev_is_unavailable(self):
        jev = MagicMock()
        jev.ask.side_effect = JevUnavailable("offline")

        _, result = self.before(jev)

        self.assertIsInstance(result, Proceed)
        self.assertEqual(self.agent.system_prompt, self.BASE_PROMPT)

    def test_logs_decision_as_json(self):
        with self.assertLogs("jev_ui_router.decision", level="INFO") as logs:
            self.before(self.jev_choosing("show_quiz"))

        record = json.loads(logs.records[0].getMessage())
        self.assertEqual(record["outcome"], "hinted")
        self.assertEqual(record["selected"], "show_quiz")


if __name__ == "__main__":
    unittest.main()
