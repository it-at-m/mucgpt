"""Production-path HTTP harness for PostgreSQL integration scenarios.

The harness intentionally starts only the pieces a request needs.  It does not
run the application's production lifespan: model metadata, Redis, Langfuse and
MCP are external boundaries and are substituted below.  Everything that owns
durable state remains real, including the Alembic schema, PostgreSQL pools,
routers, ``init_agent`` and the Deep Agent graph.
"""

from __future__ import annotations

import json
from collections.abc import AsyncGenerator, Sequence
from contextlib import asynccontextmanager, nullcontext
from dataclasses import dataclass, field
from typing import Any
from unittest.mock import AsyncMock
from uuid import uuid4

import httpx
import psycopg
from fastapi import FastAPI, UploadFile
from langchain_core.language_models import BaseChatModel
from pytest import MonkeyPatch
from tests.fakes.scripted_chat_model import ScriptedChatModel, ScriptStep
from tests.postgres import IsolatedPostgresDatabase, isolated_postgres_database

from api.routers import chat_router, document_router
from config.model_provider import ModelRegistry, ModelsConfigurationException
from core.auth import authenticate_user
from core.auth_models import AuthenticationResult
from core.persistance_helpers import PersistanceHelpers
from core.virtual_file_system_helper import FileStoreManager
from database.document_catalog import DocumentCatalogManager
from parsing.base import ParserBackend


@dataclass
class DeterministicParser(ParserBackend):
    """Parser boundary that records uploads without creating HTTP clients."""

    text: str = "Parsed test document"
    filenames: list[str] = field(default_factory=list)

    async def parse(self, file: UploadFile) -> str:
        self.filenames.append(file.filename or "")
        return self.text


class _NoopObservation:
    """Small synchronous observation compatible with the Langfuse call sites."""

    def __enter__(self) -> _NoopObservation:
        return self

    def __exit__(self, *_: object) -> None:
        return None

    def update(self, **_: Any) -> None:
        return None


class NoopLangfuseClient:
    """Keep AG-UI streaming independent from Langfuse configuration and network."""

    def create_trace_id(self) -> str:
        return "postgres-http-harness-trace"

    def start_as_current_observation(self, **_: Any) -> _NoopObservation:
        return _NoopObservation()

    def update_current_span(self, **_: Any) -> None:
        return None

    def flush(self) -> None:
        return None


@dataclass
class PostgresHttpHarness:
    """One isolated database, real request stack, and deterministic boundaries."""

    database: IsolatedPostgresDatabase
    monkeypatch: MonkeyPatch
    app: FastAPI
    client: httpx.AsyncClient
    owner: AuthenticationResult
    foreign_user: AuthenticationResult
    parser: DeterministicParser
    model: ScriptedChatModel
    _current_user: AuthenticationResult
    _runtime_state: dict[str, Any] = field(repr=False)

    def as_user(self, user: AuthenticationResult) -> PostgresHttpHarness:
        """Select the identity returned by the real routers' auth dependency."""
        self._current_user = user
        self._runtime_state["user"] = user
        return self

    def use_owner(self) -> PostgresHttpHarness:
        """Restore the default owner identity after an authorization assertion."""
        return self.as_user(self.owner)

    def set_model_script(self, script: Sequence[ScriptStep]) -> ScriptedChatModel:
        """Replace the finite scripted-model sequence for the next agent request."""
        self.model = ScriptedChatModel(script=list(script))
        self._runtime_state["model"] = self.model
        return self.model

    def persisted_chat_body(
        self, content: str, *, conversation_id: str | None = None
    ) -> dict[str, Any]:
        """Return the smallest legacy request that exercises persisted AG-UI chat."""
        return {
            "conversation_id": conversation_id or f"harness-{uuid4()}",
            "model": "scripted-model",
            "messages": [{"role": "user", "content": content}],
            "persist": True,
            # Avoid settings-dependent creativity lookup in infrastructure tests.
            "temperature": 0.5,
        }

    async def upload_document(
        self, filename: str = "example.txt", content: bytes = b"source"
    ) -> httpx.Response:
        """Upload a multipart document through the production document router."""
        return await self.client.post(
            "/v1/documents",
            files={"file": (filename, content, "text/plain")},
        )

    async def chat_events(self, body: dict[str, Any]) -> list[dict[str, Any]]:
        """Run a chat request and decode its complete AG-UI SSE event sequence."""
        async with self.client.stream(
            "POST", "/v1/chat/v2/completions", json=body
        ) as response:
            response.raise_for_status()
            return await decode_agui_events(response)

    def assert_model_consumed(self) -> None:
        """Make an omitted model interaction visible in the scenario that owns it."""
        self.model.assert_consumed()


async def decode_agui_events(response: httpx.Response) -> list[dict[str, Any]]:
    """Decode event-stream payloads while ignoring SSE comments and blank lines."""
    events: list[dict[str, Any]] = []
    async for line in response.aiter_lines():
        if not line.startswith("data: "):
            continue
        events.append(json.loads(line.removeprefix("data: ")))
    return events


def final_text(events: Sequence[dict[str, Any]]) -> str:
    """Join AG-UI text-message chunks in the order emitted to the client."""
    return "".join(
        str(event.get("delta", ""))
        for event in events
        if event.get("type") == "TEXT_MESSAGE_CHUNK"
    )


def _test_user(user_id: str, name: str) -> AuthenticationResult:
    return AuthenticationResult(
        token=f"test-token-{user_id}",
        user_id=user_id,
        name=name,
        department="Test Department",
    )


@asynccontextmanager
async def postgres_http_harness(
    monkeypatch: MonkeyPatch,
) -> AsyncGenerator[PostgresHttpHarness]:
    """Create an isolated, migrated database-backed HTTP harness.

    ``MonkeyPatch`` is supplied by the test so every external-boundary override
    participates in pytest's normal cleanup even when setup fails.
    """
    async with isolated_postgres_database(prefix="http_harness_") as database:
        app = FastAPI(title="MUCGPT PostgreSQL HTTP harness")
        app.include_router(chat_router.router)
        app.include_router(document_router.router)

        owner = _test_user("harness-owner", "Harness Owner")
        foreign_user = _test_user("harness-foreign", "Harness Foreign User")
        parser = DeterministicParser()
        initial_model = ScriptedChatModel(script=[])
        state: dict[str, Any] = {"user": owner, "model": initial_model}

        async def current_user() -> AuthenticationResult:
            return state["user"]

        def scripted_model(name: str | None = None, **_: Any) -> BaseChatModel:
            if name not in {None, "scripted-model"}:
                raise ModelsConfigurationException(
                    f"Model {name!r} not found in the registry"
                )
            return state["model"]

        # Router-level dependency overrides retain FastAPI's real dependency
        # resolution while making user switching a per-request test concern.
        app.dependency_overrides[authenticate_user] = current_user
        monkeypatch.setattr(ModelRegistry, "get_model", staticmethod(scripted_model))
        monkeypatch.setattr("core.document_service.get_parser", lambda: parser)
        monkeypatch.setattr(
            "agent.tools.mcp.McpLoader.load_mcp_tools", AsyncMock(return_value=[])
        )

        # The production stream creates a trace around every agent run.  Replace
        # only that telemetry edge, not the executor or the graph underneath it.
        no_op_langfuse = NoopLangfuseClient()
        monkeypatch.setattr(
            "api.routers.chat_router.get_client", lambda: no_op_langfuse
        )
        monkeypatch.setattr(
            "api.routers.chat_router.propagate_attributes", lambda **_: nullcontext()
        )
        monkeypatch.setattr("agent.agent_executor.get_client", lambda: no_op_langfuse)
        monkeypatch.setattr(
            "agent.agent_executor.propagate_attributes", lambda **_: nullcontext()
        )
        monkeypatch.setattr("agent.middleware._make_scoped_callbacks", lambda: [])

        harness: PostgresHttpHarness | None = None
        failed = False
        try:
            await PersistanceHelpers.init(database.settings)
            await FileStoreManager.init(database.settings)
            await DocumentCatalogManager.init(database.settings)

            async with httpx.AsyncClient(
                transport=httpx.ASGITransport(app=app), base_url="http://testserver"
            ) as client:
                harness = PostgresHttpHarness(
                    database=database,
                    monkeypatch=monkeypatch,
                    app=app,
                    client=client,
                    owner=owner,
                    foreign_user=foreign_user,
                    parser=parser,
                    model=initial_model,
                    _current_user=owner,
                    _runtime_state=state,
                )
                yield harness
        except BaseException:
            failed = True
            raise
        finally:
            # Match production shutdown order: catalog sessions may be in
            # document cleanup paths, then the document store, then chat state.
            await DocumentCatalogManager.close()
            await FileStoreManager.close()
            await PersistanceHelpers.close()
            await _assert_no_idle_transaction(database)
            assert DocumentCatalogManager._engine is None
            assert FileStoreManager._pool is None
            assert FileStoreManager._file_store is None
            assert PersistanceHelpers._pool is None
            assert PersistanceHelpers._checkpointer is None
            assert PersistanceHelpers._engine is None
            if harness is not None and not failed:
                harness.assert_model_consumed()
            app.dependency_overrides.clear()


async def _assert_no_idle_transaction(database: IsolatedPostgresDatabase) -> None:
    """Fail before force-dropping a DB if application cleanup leaked a transaction."""
    conninfo = " ".join(
        f"{key}={value}"
        for key, value in {**database.connection_args, "dbname": database.name}.items()
    )
    async with await psycopg.AsyncConnection.connect(
        conninfo, autocommit=True
    ) as connection:
        result = await connection.execute(
            "SELECT count(*) FROM pg_stat_activity "
            "WHERE datname = current_database() AND state = 'idle in transaction'"
        )
        row = await result.fetchone()
        assert row is not None
        assert row[0] == 0
