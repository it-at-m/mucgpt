"""Opt-in real PostgreSQL lifecycle tests (also runnable with unittest).

Set MUCGPT_LIFECYCLE_POSTGRES_HOST to an isolated test PostgreSQL server.
Each test creates and drops its own database; never use production credentials.
"""

import asyncio
import json
import os
import unittest
from types import SimpleNamespace
from typing import Any, cast
from unittest.mock import AsyncMock, Mock, patch
from uuid import uuid4

import psycopg
from fastapi import FastAPI, HTTPException, Request
from langchain_core.messages import AIMessage, HumanMessage
from langchain_core.runnables import RunnableConfig
from langgraph.checkpoint.postgres.aio import AsyncPostgresSaver
from langgraph.graph import END, START, MessagesState, StateGraph
from psycopg import AsyncConnection, sql
from psycopg.conninfo import make_conninfo
from psycopg.rows import dict_row
from psycopg_pool import AsyncConnectionPool
from pydantic import SecretStr

from agent.agent_executor import MUCGPTAgentExecutor
from agent.deep_agent import (
    CHECKPOINT_DURABILITY,
    MUCGPTAgent,
    _ConfiguredLangChainDeepAgentGraph,
)
from api.api_models import (
    ChatCompletionMessage,
    ChatCompletionRequest,
    ConversationRenameRequest,
)
from api.routers.chat_router import (
    ag_ui_chat_endpoint,
    delete_conversation,
    get_conversation_messages,
    get_messages_for_agent,
    rename_conversation,
    router,
)
from config.settings import DBConfig, Settings
from core.auth import authenticate_user
from core.auth_models import AuthenticationResult
from core.persistance_helpers import PersistanceHelpers
from database.fenced_checkpointer import ConversationDeletedError, FencedPostgresSaver


@unittest.skipUnless(
    os.getenv("MUCGPT_LIFECYCLE_POSTGRES_HOST"), "real PostgreSQL opt-in required"
)
class ConversationLifecyclePostgresTests(unittest.IsolatedAsyncioTestCase):
    async def asyncSetUp(self):
        self.database = "lifecycle_test_" + uuid4().hex
        # PostgreSQL conninfo keywords: all values as strings.
        self.connection_args = {
            "host": os.environ["MUCGPT_LIFECYCLE_POSTGRES_HOST"],
            "port": os.getenv("MUCGPT_LIFECYCLE_POSTGRES_PORT", "5432"),
            "user": os.getenv("MUCGPT_LIFECYCLE_POSTGRES_USER", "admin"),
            "password": os.getenv("MUCGPT_LIFECYCLE_POSTGRES_PASSWORD", "admin"),
        }
        async with await psycopg.AsyncConnection.connect(
            make_conninfo(**self.connection_args, dbname="postgres"), autocommit=True
        ) as connection:
            await connection.execute(
                sql.SQL("CREATE DATABASE {}").format(sql.Identifier(self.database))
            )
        self.addAsyncCleanup(self.drop_database)
        self.settings = Settings(
            db=DBConfig(
                host=str(self.connection_args["host"]),
                port=int(self.connection_args["port"]),
                name=self.database,
                user=str(self.connection_args["user"]),
                password=SecretStr(str(self.connection_args["password"])),
            )
        )
        await PersistanceHelpers.init(self.settings)
        self.addAsyncCleanup(PersistanceHelpers.close)
        self.conversation_id = uuid4().hex
        self.owner = AuthenticationResult(
            user_id="owner-a", token="test", department="test"
        )
        self.other = AuthenticationResult(
            user_id="owner-b", token="test", department="test"
        )

    async def drop_database(self):
        async with await psycopg.AsyncConnection.connect(
            make_conninfo(**self.connection_args, dbname="postgres"), autocommit=True
        ) as connection:
            await connection.execute(
                sql.SQL("DROP DATABASE {} WITH (FORCE)").format(
                    sql.Identifier(self.database)
                )
            )

    def pool(self) -> AsyncConnectionPool[AsyncConnection[dict[str, Any]]]:
        """The PersistanceHelpers pool, guaranteed to be initialized here."""
        pool = PersistanceHelpers._pool
        assert pool is not None
        return pool

    def request(self):
        return ChatCompletionRequest(
            conversation_id=self.conversation_id,
            messages=[
                ChatCompletionMessage(role="user", content="private question from A")
            ],
        )

    async def seed_history(self):
        """Create a real exit checkpoint without a provider/model dependency."""
        await get_messages_for_agent(self.request(), self.owner.user_id)
        # ty cannot verify that TypedDicts satisfy langgraph's StateLike bound
        # (same stub limitation as in app/agent/tools/simplify_agent.py).
        graph = (
            StateGraph(MessagesState)  # ty: ignore[invalid-argument-type]
            .add_node(
                "answer",
                lambda state: {"messages": [AIMessage(content="saved answer")]},
            )
            .add_edge(START, "answer")
            .add_edge("answer", END)
            .compile(checkpointer=PersistanceHelpers.get_checkpointer())
        )
        await graph.ainvoke(
            {"messages": [HumanMessage(content="saved question")]},
            {"configurable": {"thread_id": self.conversation_id}},
            durability=CHECKPOINT_DURABILITY,
        )

    async def test_manual_rename_persists_and_rejects_foreign_missing_and_retired_ids(
        self,
    ):
        await PersistanceHelpers.verify_user_in_conversation(
            self.owner.user_id, self.conversation_id, "assistant-123"
        )
        request = ConversationRenameRequest(title="Renamed chat")
        await rename_conversation(self.conversation_id, request, self.owner)
        rows = await PersistanceHelpers.get_conversations_for_user(self.owner.user_id)
        self.assertEqual(rows[0]["title"], "Renamed chat")
        self.assertEqual(rows[0]["assistant_id"], "assistant-123")

        with self.assertRaises(HTTPException) as failure:
            await rename_conversation(self.conversation_id, request, self.other)
        self.assertEqual(failure.exception.status_code, 403)
        rows = await PersistanceHelpers.get_conversations_for_user(self.owner.user_id)
        self.assertEqual(rows[0]["title"], "Renamed chat")

        missing = uuid4().hex
        with self.assertRaises(HTTPException) as failure:
            await rename_conversation(missing, request, self.owner)
        self.assertEqual(failure.exception.status_code, 404)
        self.assertFalse(await PersistanceHelpers.conversation_exists(missing))

        await delete_conversation(self.conversation_id, self.owner)
        with self.assertRaises(HTTPException) as failure:
            await rename_conversation(self.conversation_id, request, self.owner)
        self.assertEqual(failure.exception.status_code, 403)
        self.assertEqual(
            await PersistanceHelpers.get_conversations_for_user(self.owner.user_id), []
        )

    async def test_controlled_exit_write_after_deletion(self):
        """A paused exit writer cannot restore state after committed erasure."""
        await get_messages_for_agent(self.request(), self.owner.user_id)
        saver = PersistanceHelpers.get_checkpointer()
        paused, resume = asyncio.Event(), asyncio.Event()
        original_put = saver.aput

        async def paused_put(*args, **kwargs):
            paused.set()
            await resume.wait()
            return await original_put(*args, **kwargs)

        saver.aput = paused_put
        # ty cannot verify that TypedDicts satisfy langgraph's StateLike bound
        # (same stub limitation as in app/agent/tools/simplify_agent.py).
        graph = (
            StateGraph(MessagesState)  # ty: ignore[invalid-argument-type]
            .add_node(
                "answer",
                lambda state: {
                    "messages": [AIMessage(content="private answer from A")]
                },
            )
            .add_edge(START, "answer")
            .add_edge("answer", END)
            .compile(checkpointer=saver)
        )
        writer = asyncio.create_task(
            graph.ainvoke(
                {"messages": [HumanMessage(content="private question from A")]},
                {"configurable": {"thread_id": self.conversation_id}},
                durability=CHECKPOINT_DURABILITY,
            )
        )
        try:
            await asyncio.wait_for(paused.wait(), 10)
            await delete_conversation(self.conversation_id, self.owner)
            self.assertTrue(
                await PersistanceHelpers.conversation_exists(self.conversation_id)
            )
            resume.set()
            with self.assertRaises(ConversationDeletedError):
                await asyncio.wait_for(writer, 10)
            await self.assert_retired()
        finally:
            resume.set()
            await asyncio.gather(writer, return_exceptions=True)
            saver.aput = original_put

    async def assert_retired(self):
        """Retired IDs reject both owners and have no physical checkpoint rows."""
        for user in (self.owner, self.other):
            with self.assertRaises(HTTPException) as failure:
                await get_messages_for_agent(self.request(), user.user_id)
            self.assertEqual(failure.exception.status_code, 403)
            with self.assertRaises(HTTPException) as failure:
                await get_conversation_messages(self.conversation_id, user)
            self.assertEqual(failure.exception.status_code, 403)
            self.assertFalse(
                await PersistanceHelpers.set_chat_title_for_conversation(
                    self.conversation_id, user.user_id, "revive"
                )
            )
            self.assertEqual(
                await PersistanceHelpers.get_conversations_for_user(user.user_id), []
            )
        async with self.pool().connection() as connection:
            for table in ("checkpoints", "checkpoint_writes", "checkpoint_blobs"):
                result = await connection.execute(
                    sql.SQL(
                        "SELECT count(*) AS count FROM {} WHERE thread_id = %s"
                    ).format(sql.Identifier(table)),
                    (self.conversation_id,),
                )
                row = await result.fetchone()
                assert row is not None
                self.assertEqual(row["count"], 0)

    async def test_independent_service_saver_is_fenced(self):
        await get_messages_for_agent(self.request(), self.owner.user_id)
        pool: AsyncConnectionPool[AsyncConnection[dict[str, Any]]] = AsyncConnectionPool(
            open=False,
            kwargs={
                **self.connection_args,
                "dbname": self.database,
                "autocommit": True,
                "row_factory": dict_row,
            },
        )
        await pool.open()
        self.addAsyncCleanup(pool.close)
        independent = FencedPostgresSaver(pool)
        await delete_conversation(self.conversation_id, self.owner)
        config: RunnableConfig = {
            "configurable": {
                "thread_id": self.conversation_id,
                "checkpoint_ns": "",
                "checkpoint_id": uuid4().hex,
            }
        }
        with self.assertRaises(ConversationDeletedError):
            await independent.aput_writes(
                config, [("messages", [HumanMessage(content="late")])], "task"
            )
        with self.assertRaises(ConversationDeletedError):
            await independent.aget(config)
        await self.assert_retired()

    async def test_delete_waits_for_atomic_writer_and_erases_it(self):
        await get_messages_for_agent(self.request(), self.owner.user_id)
        saver = PersistanceHelpers.get_checkpointer()
        assert isinstance(saver, FencedPostgresSaver)
        locked, resume = asyncio.Event(), asyncio.Event()

        async def writer():
            # This is the same transaction boundary used by every fenced write.
            async with saver._live_saver(self.conversation_id) as bound:
                locked.set()
                await resume.wait()
                await bound.aput_writes(
                    {
                        "configurable": {
                            "thread_id": self.conversation_id,
                            "checkpoint_ns": "",
                            "checkpoint_id": "checkpoint",
                        }
                    },
                    [("messages", [HumanMessage(content="in flight")])],
                    "task",
                )

        task = asyncio.create_task(writer())
        deletion = None
        try:
            await asyncio.wait_for(locked.wait(), 10)
            deletion = asyncio.create_task(
                delete_conversation(self.conversation_id, self.owner)
            )

            # Observe a real PostgreSQL lock wait, rather than assuming timing.
            async def waiting():
                while True:
                    async with self.pool().connection() as connection:
                        result = await connection.execute(
                            "SELECT count(*) AS count FROM pg_stat_activity WHERE datname = %s AND wait_event_type = 'Lock'",
                            (self.database,),
                        )
                        row = await result.fetchone()
                        assert row is not None
                        if row["count"]:
                            return
                    await asyncio.sleep(0)

            await asyncio.wait_for(waiting(), 10)
            self.assertFalse(deletion.done())
            resume.set()
            await asyncio.wait_for(task, 10)
            await asyncio.wait_for(deletion, 10)
            await self.assert_retired()
        finally:
            resume.set()
            await asyncio.gather(
                task, *([deletion] if deletion else []), return_exceptions=True
            )

    async def test_failed_erasure_rolls_back_and_owner_can_retry(self):
        await self.seed_history()
        async with self.pool().connection() as connection:
            await connection.execute(
                "CREATE FUNCTION fail_erasure() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'controlled erasure failure'; END $$"
            )
            await connection.execute(
                "CREATE TRIGGER fail_erasure BEFORE DELETE ON checkpoint_writes FOR EACH STATEMENT EXECUTE FUNCTION fail_erasure()"
            )
        with self.assertRaises(HTTPException) as failure:
            await delete_conversation(self.conversation_id, self.owner)
        self.assertEqual(failure.exception.status_code, 500)
        self.assertEqual(
            [
                message.content
                for message in await get_conversation_messages(
                    self.conversation_id, self.owner
                )
            ],
            ["saved question", "saved answer"],
        )
        self.assertTrue(
            await PersistanceHelpers.is_user_in_conversation(
                self.owner.user_id, self.conversation_id
            )
        )
        self.assertFalse(
            await PersistanceHelpers.verify_user_in_conversation(
                self.other.user_id, self.conversation_id
            )
        )
        async with self.pool().connection() as connection:
            await connection.execute("DROP TRIGGER fail_erasure ON checkpoint_writes")
        await delete_conversation(self.conversation_id, self.owner)
        await delete_conversation(self.conversation_id, self.owner)
        await self.assert_retired()

    async def test_legacy_mapped_history_survives_migration(self):
        await self.seed_history()
        async with self.pool().connection() as connection:
            await connection.execute("ALTER TABLE chats DROP COLUMN deleted_at")
        await PersistanceHelpers.close()
        await PersistanceHelpers.init(self.settings)
        self.assertEqual(
            [
                message.content
                for message in await get_conversation_messages(
                    self.conversation_id, self.owner
                )
            ],
            ["saved question", "saved answer"],
        )
        with self.assertRaises(HTTPException) as failure:
            await get_messages_for_agent(self.request(), self.other.user_id)
        self.assertEqual(failure.exception.status_code, 403)
        await delete_conversation(self.conversation_id, self.owner)
        await self.assert_retired()

    async def test_legacy_orphans_are_quarantined_on_restart(self):
        async with self.pool().connection() as connection:
            # Simulate the pre-fence schema and orphan pending state.
            await connection.execute("ALTER TABLE chats DROP COLUMN deleted_at")
            await AsyncPostgresSaver(connection).aput_writes(
                {
                    "configurable": {
                        "thread_id": self.conversation_id,
                        "checkpoint_ns": "",
                        "checkpoint_id": "legacy",
                    }
                },
                [("messages", [HumanMessage(content="legacy private")])],
                "task",
            )
        await PersistanceHelpers.close()
        await PersistanceHelpers.init(self.settings)
        await self.assert_retired()
        await PersistanceHelpers.close()
        await PersistanceHelpers.init(self.settings)
        await self.assert_retired()

    async def test_ag_ui_endpoint_success_failure_disconnect_and_cancel(self):
        """Real executors/graphs/persistence; inject only model/agent construction."""
        for stream in (False, True):
            for outcome in ("success", "failure", "disconnect", "cancel"):
                with self.subTest(stream=stream, outcome=outcome):
                    self.conversation_id = uuid4().hex
                    saver = PersistanceHelpers.get_checkpointer()
                    paused, resume = asyncio.Event(), asyncio.Event()
                    original_put = saver.aput

                    async def paused_put(*args, **kwargs):
                        paused.set()
                        await resume.wait()
                        return await original_put(*args, **kwargs)

                    def answer(state):
                        if outcome == "failure":
                            raise RuntimeError("controlled generation failure")
                        return {
                            "messages": [AIMessage(content="private answer from A")]
                        }

                    # ty cannot verify that TypedDicts satisfy langgraph's StateLike
                    # bound (same stub limitation as in app/agent/tools/simplify_agent.py).
                    graph = (
                        StateGraph(MessagesState)  # ty: ignore[invalid-argument-type]
                        .add_node("answer", answer)
                        .add_edge(START, "answer")
                        .add_edge("answer", END)
                        .compile(checkpointer=saver)
                    )
                    wrapper = _ConfiguredLangChainDeepAgentGraph.__new__(
                        _ConfiguredLangChainDeepAgentGraph
                    )
                    wrapper.agent = cast("Any", graph)
                    wrapper.state_schema = cast("Any", MessagesState)
                    wrapper._prepare_run = cast(
                        "Any",
                        lambda data, config: (
                            data["messages"],
                            None,
                            None,
                        ),
                    )
                    executor = MUCGPTAgentExecutor(
                        cast("MUCGPTAgent", SimpleNamespace(graph=wrapper))
                    )
                    request = self.request()
                    request.stream = stream
                    chunks = []
                    disconnect = asyncio.Queue()
                    disconnected = asyncio.Event()

                    async def run():
                        if outcome == "disconnect":
                            app = FastAPI()
                            app.include_router(router)
                            app.dependency_overrides[authenticate_user] = lambda: (
                                self.owner
                            )
                            path = "/v1/chat/v2/completions"
                            scope = {
                                "type": "http",
                                "asgi": {"spec_version": "2.0"},
                                "http_version": "1.1",
                                "method": "POST",
                                "scheme": "http",
                                "path": path,
                                "raw_path": path.encode(),
                                "root_path": "",
                                "query_string": b"",
                                "headers": [(b"content-type", b"application/json")],
                                "client": ("test", 1),
                                "server": ("test", 80),
                            }
                            await disconnect.put(
                                {
                                    "type": "http.request",
                                    "body": json.dumps(request.model_dump()).encode(),
                                    "more_body": False,
                                }
                            )

                            async def receive():
                                message = await disconnect.get()
                                if message["type"] == "http.disconnect":
                                    disconnected.set()
                                return message

                            async def send(message):
                                chunks.append(message)

                            await app(scope, receive, send)
                            return
                        response = await ag_ui_chat_endpoint(
                            request,
                            self.owner,
                            Request({"type": "http", "headers": []}),
                        )
                        if hasattr(response, "body_iterator"):
                            body_iterator = cast("Any", response.body_iterator)
                            try:
                                async for chunk in body_iterator:
                                    chunks.append(chunk)
                            finally:
                                await body_iterator.aclose()
                        return response

                    saver.aput = paused_put
                    task = None
                    try:
                        with (
                            patch(
                                "api.routers.chat_router.ModelRegistry.get_model",
                                Mock(),
                            ),
                            patch(
                                "api.routers.chat_router.init_agent",
                                AsyncMock(return_value=executor),
                            ),
                        ):
                            task = asyncio.create_task(run())
                            await asyncio.wait_for(paused.wait(), 10)
                            await delete_conversation(self.conversation_id, self.owner)
                            if outcome == "disconnect":
                                await disconnect.put({"type": "http.disconnect"})
                            elif outcome == "cancel":
                                task.cancel()
                            resume.set()
                            result = await asyncio.wait_for(
                                asyncio.gather(task, return_exceptions=True), 10
                            )
                            if outcome == "disconnect":
                                self.assertIsNone(result[0])
                                self.assertTrue(disconnected.is_set())
                                self.assertTrue(
                                    any(
                                        chunk["type"] == "http.response.start"
                                        for chunk in chunks
                                    )
                                )
                            elif outcome == "cancel":
                                self.assertIsInstance(result[0], asyncio.CancelledError)
                            else:
                                self.assertTrue(
                                    any("RUN_ERROR" in chunk for chunk in chunks)
                                )
                        await self.assert_retired()
                        async with self.pool().connection() as connection:
                            result = await connection.execute(
                                "SELECT count(*) AS count FROM pg_stat_activity WHERE datname = %s AND state = 'idle in transaction'",
                                (self.database,),
                            )
                            row = await result.fetchone()
                            assert row is not None
                            self.assertEqual(row["count"], 0)
                    finally:
                        resume.set()
                        if task is not None:
                            await asyncio.gather(task, return_exceptions=True)
                        saver.aput = original_put


if __name__ == "__main__":
    unittest.main()
