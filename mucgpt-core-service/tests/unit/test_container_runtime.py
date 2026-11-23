import os
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
