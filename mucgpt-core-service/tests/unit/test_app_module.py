"""Tests for the app.py entrypoint module.

The module is executed twice via runpy: once with default arguments
(production host binding) and once with --development. uvicorn.run and the
truststore injection are mocked out; the tests assert the wiring only.
"""

import logging
import runpy
import sys
from unittest.mock import MagicMock

import pytest

LOGCONF = "app/logconf.yaml"


@pytest.fixture(autouse=True)
def _isolate_env(monkeypatch: pytest.MonkeyPatch):
    """Keep the runpy executions deterministic and side-effect free."""
    monkeypatch.setenv("TRUSTSTORE_DISABLE", "1")  # skip SSL monkey-patching
    monkeypatch.setenv("LOG_CONFIG", LOGCONF)
    monkeypatch.setattr(sys, "argv", ["app"])


def _run_entrypoint(
    monkeypatch: pytest.MonkeyPatch,
    *args: str,
    inject_into_ssl: MagicMock | None = None,
):
    uvicorn_run = MagicMock()
    monkeypatch.setattr("uvicorn.run", uvicorn_run)
    if inject_into_ssl is None:
        inject_into_ssl = MagicMock()
    monkeypatch.setattr("truststore.inject_into_ssl", inject_into_ssl)
    monkeypatch.setenv("TRUSTSTORE_DISABLE", "0" if inject_into_ssl else "1")
    monkeypatch.setattr(sys, "argv", ["app", *args])
    runpy.run_module("app", run_name="__main__", alter_sys=True)
    return uvicorn_run, inject_into_ssl


def test_production_host_binding(monkeypatch: pytest.MonkeyPatch):
    inject_into_ssl = MagicMock()
    uvicorn_run, _ = _run_entrypoint(monkeypatch, inject_into_ssl=inject_into_ssl)

    inject_into_ssl.assert_called_once()
    uvicorn_run.assert_called_once()
    kwargs = uvicorn_run.call_args.kwargs
    assert kwargs["host"] == "0.0.0.0"
    assert kwargs["port"] == 8080
    assert isinstance(kwargs["log_config"], dict)
    from backend import backend

    assert uvicorn_run.call_args.args[0] is backend


def test_development_binds_localhost(monkeypatch: pytest.MonkeyPatch):
    uvicorn_run, inject_into_ssl = _run_entrypoint(monkeypatch, "--development")

    assert uvicorn_run.call_args.kwargs["host"] == "localhost"


def test_truststore_failure_is_non_fatal(monkeypatch: pytest.MonkeyPatch):
    """A failing SSL injection logs a warning instead of aborting startup."""
    inject_into_ssl = MagicMock(side_effect=RuntimeError("boom"))
    # The app's dictConfig replaces root handlers, so caplog cannot see the
    # warning; spy on the module logger ("__main__" under runpy) instead.
    main_logger = MagicMock()
    real_get_logger = logging.getLogger

    def fake_get_logger(name=None):
        return main_logger if name == "__main__" else real_get_logger(name)

    monkeypatch.setattr(logging, "getLogger", fake_get_logger)
    uvicorn_run, _ = _run_entrypoint(monkeypatch, inject_into_ssl=inject_into_ssl)

    assert main_logger.warning.called
    assert "truststore injection failed" in str(main_logger.warning.call_args)
    uvicorn_run.assert_called_once()  # startup continues despite the failure
