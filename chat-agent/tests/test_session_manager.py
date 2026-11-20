import unittest
from types import SimpleNamespace
from unittest.mock import patch

from chat import main


def request(forwarded_props, thread_id="thread-1"):
    return SimpleNamespace(forwarded_props=forwarded_props, thread_id=thread_id)


class SessionManagerProviderTests(unittest.TestCase):
    def provide(self, input_data):
        with patch.object(main, "MEMORY_ID", "memory-1"), patch.object(
            main, "AgentCoreMemorySessionManager"
        ) as manager:
            result = main.session_manager_provider(input_data)
        return result, manager

    def test_uses_user_id_as_actor_and_thread_as_session(self):
        result, manager = self.provide(request({"userId": "user-sub-1"}))

        self.assertIsNotNone(result)
        config = manager.call_args.args[0]
        self.assertEqual(config.actor_id, "user-sub-1")
        self.assertEqual(config.session_id, "thread-1")

    def test_does_not_use_memory_without_user_id(self):
        for props in (None, {}, {"userId": ""}, {"other": 1}):
            with self.subTest(props=props):
                result, manager = self.provide(request(props))

                self.assertIsNone(result)
                manager.assert_not_called()

    def test_does_not_use_memory_without_memory_id(self):
        with patch.object(main, "MEMORY_ID", None):
            self.assertIsNone(main.session_manager_provider(request({"userId": "u"})))


if __name__ == "__main__":
    unittest.main()
