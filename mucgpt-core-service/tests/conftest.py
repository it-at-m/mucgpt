import asyncio
import atexit
import os
import signal
import sys
from pathlib import Path
from unittest.mock import AsyncMock, Mock

import pytest
from tests import container_runtime

from config.langfuse_provider import LangfuseProvider


def _collection_includes_postgres_tests(config: pytest.Config) -> bool:
    """Cheap heuristic: is a Postgres lifecycle test module part of this run?"""
    args = list(config.args) or list(config.getini("testpaths"))
    if not args:
        return True
    for arg in args:
        text = str(arg)
        if "integration" in text:
            return True
        path = Path(text)
        if path.is_dir() and any(path.glob("**/*_postgres.py")):
            return True
        if path.is_file() and "_postgres" in path.name:
            return True
    return False


_POSTGRES_CONTAINER = None
_CONTAINER_SIGNAL_HANDLERS: dict[signal.Signals, object] = {}


def _stop_postgres_container() -> None:
    """Stop the process-scoped testcontainer during every normal teardown path."""
    global _POSTGRES_CONTAINER
    if _POSTGRES_CONTAINER is not None:
        try:
            _POSTGRES_CONTAINER.stop()
        finally:
            _POSTGRES_CONTAINER = None


def _handle_container_shutdown(signum: int, frame) -> None:
    """Clean up before pytest is interrupted by Ctrl+C or termination."""
    _stop_postgres_container()
    previous = _CONTAINER_SIGNAL_HANDLERS.get(signal.Signals(signum))
    if callable(previous):
        previous(signum, frame)
    else:
        raise KeyboardInterrupt


def _suppress_coverage_gate_for_partial_runs(config: pytest.Config) -> None:
    """Coverage gates only make sense for full-suite runs.

    A partial run (e.g. `uv run pytest tests/unit`) collects a subset and would
    always report less coverage, so the `--cov-fail-under` gate from addopts is
    disabled for it. An explicit `--cov-fail-under` on the command line is kept.

    Note: pytest-cov reads the value from `config.known_args_namespace`
    (snapshot taken before conftests load), not from `config.option`, so both
    namespaces are adjusted.
    """
    if config.option.cov_fail_under is None:
        return
    if any(
        str(arg).startswith("--cov-fail-under") for arg in config.invocation_params.args
    ):
        return  # explicitly requested on the command line — respect it
    args = [str(arg) for arg in config.args]
    testpaths = [str(path) for path in config.getini("testpaths")]
    has_test_selection = bool(config.option.keyword or config.option.markexpr)
    full_suite_paths = {Path.cwd().resolve()}
    full_suite_paths.update(Path(path).resolve() for path in testpaths)
    selects_full_suite = bool(args) and all(
        Path(path).resolve() in full_suite_paths for path in args
    )
    if not has_test_selection and (not args or selects_full_suite):
        return  # full run — keep the gate
    config.option.cov_fail_under = 0
    known_args = getattr(config, "known_args_namespace", None)
    if known_args is not None and getattr(known_args, "cov_fail_under", None):
        known_args.cov_fail_under = 0


def pytest_configure(config: pytest.Config) -> None:
    """Start a throwaway PostgreSQL container when the opt-in lifecycle tests need one.

    Behavior:
    - MUCGPT_LIFECYCLE_POSTGRES_HOST already set: use that server (e.g. the CI
      service container); no container is started.
    - MUCGPT_TEST_POSTGRES=off: never start a container (tests skip as before).
    - otherwise: start a container automatically if a container runtime is
      reachable (Docker first, then Podman — our preferred local runtime;
      MUCGPT_TEST_CONTAINER_RUNTIME=docker|podman forces one); when no runtime
      is reachable, the lifecycle tests simply skip.
    """
    global _POSTGRES_CONTAINER
    _suppress_coverage_gate_for_partial_runs(config)
    if sys.platform == "win32":
        # psycopg's async driver does not support Windows' default
        # ProactorEventLoop.  Set the selector policy before unittest's
        # IsolatedAsyncioTestCase creates its per-test loops.
        getattr(asyncio, "set_event_loop_policy")(
            asyncio.WindowsSelectorEventLoopPolicy()
        )
    if os.getenv("MUCGPT_LIFECYCLE_POSTGRES_HOST"):
        return
    if os.getenv("MUCGPT_TEST_POSTGRES", "auto").strip().lower() in {
        "off",
        "false",
        "0",
        "no",
    }:
        return
    if not _collection_includes_postgres_tests(config):
        return
    try:
        from testcontainers.core.container import (  # noqa: F401 — availability check
            DockerContainer,
        )
    except ModuleNotFoundError:
        return
    container = container_runtime.start_postgres_container()
    if container is None:
        print(
            "pytest: could not start PostgreSQL testcontainer "
            "(no container runtime reachable?); Postgres lifecycle tests will skip"
        )
        return
    _POSTGRES_CONTAINER = container
    atexit.register(_stop_postgres_container)
    for signum in (signal.SIGINT, signal.SIGTERM):
        _CONTAINER_SIGNAL_HANDLERS[signum] = signal.getsignal(signum)
        signal.signal(signum, _handle_container_shutdown)
    os.environ["MUCGPT_LIFECYCLE_POSTGRES_HOST"] = str(
        container.get_container_host_ip()
    )
    os.environ["MUCGPT_LIFECYCLE_POSTGRES_PORT"] = str(
        int(container.get_exposed_port(5432))
    )
    os.environ["MUCGPT_LIFECYCLE_POSTGRES_USER"] = "admin"
    os.environ["MUCGPT_LIFECYCLE_POSTGRES_PASSWORD"] = "admin"


def pytest_unconfigure(config: pytest.Config) -> None:
    _stop_postgres_container()


@pytest.fixture(autouse=True)
def disable_langfuse(monkeypatch: pytest.MonkeyPatch) -> None:
    """Keep test runs independent from Langfuse credentials and services."""

    monkeypatch.setattr(LangfuseProvider, "_langfuse_callback", None)
    monkeypatch.setattr(LangfuseProvider, "init", staticmethod(lambda **_kwargs: None))
    monkeypatch.setattr(
        LangfuseProvider, "get_callback_handler", staticmethod(lambda: None)
    )


class FakeLock:
    def __init__(self, held: set[str], name: str) -> None:
        self.held = held
        self.name = name

    async def acquire(self) -> bool:
        if self.name in self.held:
            return False
        self.held.add(self.name)
        return True

    async def release(self) -> None:
        self.held.remove(self.name)


@pytest.fixture(autouse=True)
def held_run_locks(monkeypatch: pytest.MonkeyPatch) -> set[str]:
    held: set[str] = set()
    redis = Mock(lock=lambda name, **_kwargs: FakeLock(held, name))
    monkeypatch.setattr(
        "core.cache.RedisCache.get_redis", AsyncMock(return_value=redis)
    )
    return held
