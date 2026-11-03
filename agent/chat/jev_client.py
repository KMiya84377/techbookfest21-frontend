"""TypeSafe の Jev(System One API)を呼ぶ、小さな HTTP クライアント"""

from __future__ import annotations

import json
import threading
import time
import urllib.error
import urllib.request
from collections.abc import Mapping
from typing import Any

from bedrock_agentcore.identity.auth import requires_api_key


DEFAULT_ENDPOINT = "https://api.typesafe.ai/v1/systemone"


class JevUnavailable(RuntimeError):
    """Jev に接続できない、または応答が不正なとき"""


class JevClient:
    def __init__(
        self,
        api_key: str | None = None,
        api_key_provider_name: str | None = None,
        model: str = "jev-latest",
        endpoint: str = DEFAULT_ENDPOINT,
        timeout: float = 5.0,
        api_key_ttl: float = 300.0,
    ) -> None:
        if bool(api_key) == bool(api_key_provider_name):
            raise ValueError(
                "Set exactly one of api_key or api_key_provider_name"
            )
        self.api_key = api_key
        self.model = model
        self.endpoint = endpoint
        self.timeout = timeout
        # AgentCore Identity のキーは、プロバイダーごとに共通。しばらく使い回す
        self.api_key_ttl = api_key_ttl
        self._cached_key: str | None = None
        self._cached_at = 0.0
        self._key_lock = threading.Lock()
        self._identity_fetch = (
            requires_api_key(provider_name=api_key_provider_name)(
                self._return_api_key
            )
            if api_key_provider_name
            else None
        )

    @staticmethod
    def choice(
        instructions: str,
        criteria: Mapping[str, str],
    ) -> dict[str, Any]:
        return {
            "type": "choice",
            "instructions": instructions,
            "criteria": dict(criteria),
        }

    def ask(
        self,
        state: str,
        questions: Mapping[str, dict[str, Any]],
    ) -> dict[str, Any]:
        if self.api_key:
            return self._ask_with_api_key(state, questions, api_key=self.api_key)

        api_key = self._identity_api_key()
        try:
            return self._ask_with_api_key(state, questions, api_key=api_key)
        except JevUnavailable as error:
            # キーが更新された可能性がある。次の呼び出しで、取得し直す
            cause = error.__cause__
            if isinstance(cause, urllib.error.HTTPError) and cause.code in (401, 403):
                self._clear_cached_key()
            raise

    @staticmethod
    def _return_api_key(*, api_key: str) -> str:
        return api_key

    def _clear_cached_key(self) -> None:
        with self._key_lock:
            self._cached_key = None

    def _identity_api_key(self) -> str:
        if self._identity_fetch is None:
            raise JevUnavailable("No Jev API credential source is configured")

        with self._key_lock:
            if self._cached_key and time.monotonic() - self._cached_at < self.api_key_ttl:
                return self._cached_key
            try:
                api_key = self._identity_fetch()
            except Exception as error:
                # 例外の本文は、詳細を含むことがあるので出さず、種類とエラーコードだけを残す
                reason = type(error).__name__
                response = getattr(error, "response", None)
                error_detail = response.get("Error") if isinstance(response, dict) else None
                error_code = (
                    error_detail.get("Code")
                    if isinstance(error_detail, dict)
                    else None
                )
                if isinstance(error_code, str) and error_code:
                    reason = error_code
                raise JevUnavailable(
                    "Could not obtain the Jev API key from AgentCore Identity "
                    f"({reason})"
                ) from error
            self._cached_key = api_key
            self._cached_at = time.monotonic()
            return api_key

    def _ask_with_api_key(
        self,
        state: str,
        questions: Mapping[str, dict[str, Any]],
        *,
        api_key: str,
    ) -> dict[str, Any]:
        body = json.dumps(
            {"state": state, "model": self.model, "questions": dict(questions)},
            ensure_ascii=False,
        ).encode("utf-8")
        request = urllib.request.Request(
            self.endpoint,
            data=body,
            headers={
                "Authorization": f"Bearer {api_key}",
                "Content-Type": "application/json",
            },
            method="POST",
        )

        try:
            with urllib.request.urlopen(request, timeout=self.timeout) as response:
                payload = json.loads(response.read())
        except urllib.error.HTTPError as error:
            raise JevUnavailable(
                f"Jev API returned HTTP {error.code}"
            ) from error
        except (urllib.error.URLError, OSError) as error:
            raise JevUnavailable(f"Could not reach Jev API: {error}") from error
        except (json.JSONDecodeError, UnicodeDecodeError) as error:
            raise JevUnavailable("Jev API returned invalid JSON") from error

        answers = payload.get("answers") if isinstance(payload, dict) else None
        if not isinstance(answers, dict):
            raise JevUnavailable("Jev API response did not contain answers")
        return answers
