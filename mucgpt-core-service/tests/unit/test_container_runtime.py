import os
import subprocess
from pathlib import Path
from typing import Self

from testcontainers.core.config import testcontainers_config
from tests import container_runtime


class _FailingContainer:
    def __init__(self, observed_sockets: list[tuple[str, str]]) -> None:
        self.observed_sockets = observed_sockets

    def start(self) -> Self:
        self.observed_sockets.append(
            (
                os.environ["TESTCONTAINERS_DOCKER_SOCKET_OVERRIDE"],
                testcontainers_config.ryuk_docker_socket,
            )
        )
        raise ConnectionError("unavailable")

    def stop(self) -> None:
        pass


def test_start_container_replaces_helper_socket_override_between_failures(
    monkeypatch, tmp_path
) -> None:
    first_socket = tmp_path / "first.sock"
    second_socket = tmp_path / "second.sock"
    first_socket.touch()
    second_socket.touch()
    observed_sockets: list[tuple[str, str]] = []

    monkeypatch.setenv("MUCGPT_TEST_CONTAINER_RUNTIME", "podman")
    monkeypatch.delenv("TESTCONTAINERS_DOCKER_SOCKET_OVERRIDE", raising=False)
    monkeypatch.setattr(
        container_runtime,
        "_podman_socket_candidates",
        lambda: [first_socket, second_socket],
    )
    monkeypatch.setattr(testcontainers_config, "_ryuk_docker_socket", "")

    assert (
        container_runtime.start_container(lambda: _FailingContainer(observed_sockets))
        is None
    )
    assert observed_sockets == [
        (str(first_socket), str(first_socket)),
        (str(second_socket), str(second_socket)),
    ]
    assert "TESTCONTAINERS_DOCKER_SOCKET_OVERRIDE" not in os.environ


def test_configure_podman_runtime_preserves_user_socket_override(monkeypatch) -> None:
    user_socket = "/custom/docker.sock"
    monkeypatch.setenv("TESTCONTAINERS_DOCKER_SOCKET_OVERRIDE", user_socket)
    monkeypatch.setattr(testcontainers_config, "_ryuk_docker_socket", "/stale.sock")

    assert not container_runtime.configure_podman_runtime(
        Path("/run/podman/podman.sock")
    )
    assert os.environ["TESTCONTAINERS_DOCKER_SOCKET_OVERRIDE"] == user_socket
    assert testcontainers_config.ryuk_docker_socket == user_socket


def test_configure_podman_pipe_disables_ryuk_in_loaded_configuration(
    monkeypatch,
) -> None:
    monkeypatch.delenv("DOCKER_HOST", raising=False)
    monkeypatch.delenv("TESTCONTAINERS_RYUK_DISABLED", raising=False)
    monkeypatch.setattr(testcontainers_config, "_ryuk_disabled", None)

    container_runtime.configure_podman_pipe(r"\\.\pipe\podman-machine-default")

    assert os.environ["DOCKER_HOST"] == "npipe:////./pipe/podman-machine-default"
    assert os.environ["TESTCONTAINERS_RYUK_DISABLED"] == "true"
    assert testcontainers_config.ryuk_disabled is True


def test_start_windows_podman_postgres_uses_cli_and_waits_for_readiness(
    monkeypatch,
) -> None:
    commands: list[tuple[str, ...]] = []

    def run_podman(*args: str, check: bool = True) -> subprocess.CompletedProcess[str]:
        commands.append(args)
        if args[0] == "port":
            return subprocess.CompletedProcess(args, 0, "127.0.0.1:49123\n", "")
        if args[0] == "exec":
            return subprocess.CompletedProcess(args, 0, "", "")
        return subprocess.CompletedProcess(args, 0, "container-id\n", "")

    monkeypatch.setattr(container_runtime.shutil, "which", lambda _name: "podman")
    monkeypatch.setattr(container_runtime, "_run_podman", run_podman)

    container = container_runtime._start_windows_podman_postgres()

    assert container is not None
    assert container.get_container_host_ip() == "127.0.0.1"
    assert container.get_exposed_port(5432) == 49123
    assert commands[0][0] == "run"
    assert commands[1][0] == "port"
    assert commands[2][0] == "exec"


def test_podman_published_port_rejects_unexpected_output() -> None:
    assert container_runtime._podman_published_port("[::1]:49123\n") == 49123
    try:
        container_runtime._podman_published_port("not a port")
    except ValueError as error:
        assert "published PostgreSQL port" in str(error)
    else:
        raise AssertionError("invalid Podman port output should be rejected")


def test_start_windows_podman_container_supports_valkey_readiness(monkeypatch) -> None:
    commands: list[tuple[str, ...]] = []

    def run_podman(*args: str, check: bool = True) -> subprocess.CompletedProcess[str]:
        commands.append(args)
        if args[0] == "port":
            return subprocess.CompletedProcess(args, 0, "127.0.0.1:49124\n", "")
        return subprocess.CompletedProcess(args, 0, "", "")

    monkeypatch.setattr(container_runtime.shutil, "which", lambda _name: "podman")
    monkeypatch.setattr(container_runtime, "_run_podman", run_podman)

    container = container_runtime._start_windows_podman_container(
        image="valkey/valkey:8.1",
        container_port=6379,
        readiness_command=("valkey-cli", "ping"),
    )

    assert container is not None
    assert container.get_exposed_port(6379) == 49124
    assert container.get_exposed_port() == 49124
    assert commands[0][-1] == "valkey/valkey:8.1"
    assert commands[2][-2:] == ("valkey-cli", "ping")
