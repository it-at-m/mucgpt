"""Container-runtime detection and lifecycle for testcontainers-based tests.

Prefers the already-configured Docker endpoint; otherwise falls back to the
Podman API socket, because Podman is the preferred local container runtime
(see stack/README.md). testcontainers talks to the Docker-compatible Podman
API via docker-py (DOCKER_HOST); Ryuk additionally needs the socket mounted
at the same path (TESTCONTAINERS_DOCKER_SOCKET_OVERRIDE). On Windows, Podman's
CLI starts PostgreSQL directly because docker-py's named-pipe transport can
block indefinitely.

Knobs:
- MUCGPT_TEST_CONTAINER_RUNTIME=auto|docker|podman (default auto)
- MUCGPT_TEST_POSTGRES=off disables PostgreSQL-based tests entirely.
"""

from __future__ import annotations

import os
import shutil
import subprocess
import time
from collections.abc import Callable
from pathlib import Path
from typing import TYPE_CHECKING, Protocol, Self
from uuid import uuid4

if TYPE_CHECKING:
    from testcontainers.community.postgres import PostgresContainer

POSTGRES_IMAGE = "postgres:17.4"


class StartableContainer(Protocol):
    """Minimal testcontainers lifecycle contract used by the runtime helper."""

    def start(self) -> Self: ...

    def stop(self) -> None: ...


class RunningNetworkContainer(StartableContainer, Protocol):
    """Container operations the pytest lifecycle needs after startup."""

    def get_container_host_ip(self) -> str: ...

    def get_exposed_port(self, port: int) -> int: ...


class WindowsPodmanContainer:
    """Small Testcontainers-compatible wrapper around a Podman CLI container.

    docker-py's named-pipe transport can block indefinitely on Windows when it
    talks to a Podman machine.  The Podman CLI does not have that limitation,
    so lifecycle tests use it directly on Windows while keeping the same
    process-scoped container lifecycle as Testcontainers.
    """

    def __init__(self, name: str, port: int, container_port: int) -> None:
        self.name = name
        self.port = port
        self.container_port = container_port

    def start(self) -> Self:
        return self

    def stop(self) -> None:
        try:
            _run_podman("rm", "--force", self.name, check=False)
        except (OSError, subprocess.SubprocessError):
            pass

    def get_container_host_ip(self) -> str:
        return "127.0.0.1"

    def get_exposed_port(self, port: int | None = None) -> int:
        if port is not None and port != self.container_port:
            raise ValueError(
                f"Container only exposes port {self.container_port}, not {port}"
            )
        return self.port


def _podman_socket_candidates() -> list[Path]:
    """Sockets where a rootless/rootful Podman API service may listen."""
    candidates: list[Path] = []
    if xdg_runtime_dir := os.environ.get("XDG_RUNTIME_DIR"):
        candidates.append(Path(xdg_runtime_dir) / "podman" / "podman.sock")
    if getuid := getattr(os, "getuid", None):
        candidates.append(Path(f"/run/user/{getuid()}/podman/podman.sock"))
    candidates.append(Path("/run/podman/podman.sock"))
    return candidates


def _podman_pipe_candidates() -> list[str]:
    """Return running Podman machine API pipes on Windows."""
    if os.name != "nt" or shutil.which("podman") is None:
        return []
    result = subprocess.run(
        [
            "podman",
            "machine",
            "inspect",
            "--format",
            "{{.ConnectionInfo.PodmanPipe.Path}}",
        ],
        capture_output=True,
        check=False,
        text=True,
    )
    candidates = []
    for line in result.stdout.splitlines():
        pipe = line.strip()
        if not pipe:
            continue
        try:
            if Path(pipe).exists():
                candidates.append(pipe)
        except OSError:
            # A busy named pipe is still a live endpoint; Windows reports
            # ERROR_PIPE_BUSY while another client is connected to it.
            candidates.append(pipe)
    return candidates


def configure_podman_runtime(socket: Path) -> bool:
    os.environ["DOCKER_HOST"] = f"unix://{socket}"
    socket_override = os.environ.get("TESTCONTAINERS_DOCKER_SOCKET_OVERRIDE")
    helper_set_socket_override = socket_override is None
    if socket_override is None:
        socket_override = str(socket)
        os.environ["TESTCONTAINERS_DOCKER_SOCKET_OVERRIDE"] = socket_override

    from testcontainers.core.config import testcontainers_config

    testcontainers_config.ryuk_docker_socket = socket_override
    return helper_set_socket_override


def configure_podman_pipe(pipe: str) -> None:
    """Configure docker-py for a Windows Podman machine named pipe."""
    pipe_name = pipe.removeprefix("\\\\.\\pipe\\")
    os.environ["DOCKER_HOST"] = f"npipe:////./pipe/{pipe_name}"
    # A Linux Ryuk container cannot mount or address a Windows named pipe.
    # pytest's process-scoped teardown stops the containers explicitly instead.
    os.environ.setdefault("TESTCONTAINERS_RYUK_DISABLED", "true")
    from testcontainers.core.config import testcontainers_config

    # conftest imports Testcontainers before this function runs, so changing
    # the environment alone is too late for the already-loaded configuration.
    testcontainers_config.ryuk_disabled = True


def _disabled(name: str) -> bool:
    return os.getenv(name, "auto").strip().lower() in {"off", "false", "0", "no"}


def postgres_container_requested() -> bool:
    """Cheap import-time probe: should Postgres-based tests be collected?"""
    if _disabled("MUCGPT_TEST_POSTGRES"):
        return False
    if _disabled("MUCGPT_TEST_CONTAINER_RUNTIME"):
        return False
    requested = os.getenv("MUCGPT_TEST_CONTAINER_RUNTIME", "auto").strip().lower()
    if requested == "docker":
        return True
    if requested == "podman":
        if os.name == "nt":
            return shutil.which("podman") is not None
        return any(socket.exists() for socket in _podman_socket_candidates())
    return True


def start_postgres_container() -> RunningNetworkContainer | None:
    """Start a throwaway PostgreSQL server, trying Docker and then Podman.

    Returns the started container, or None when no container runtime is
    reachable. Raises on import errors (dependency missing).
    """
    if os.name == "nt":
        requested = os.getenv("MUCGPT_TEST_CONTAINER_RUNTIME", "auto").strip().lower()
        if requested in {"auto", "podman"}:
            container = _start_windows_podman_postgres()
            if container is not None:
                return container
            if requested == "podman":
                return None

    from testcontainers.community.postgres import PostgresContainer

    return start_container(
        lambda: PostgresContainer(POSTGRES_IMAGE, username="admin", password="admin")
    )


def start_valkey_container() -> StartableContainer | None:
    """Start Valkey, using Podman's CLI on Windows when available."""
    if os.name == "nt":
        requested = os.getenv("MUCGPT_TEST_CONTAINER_RUNTIME", "auto").strip().lower()
        if requested in {"auto", "podman"}:
            container = _start_windows_podman_container(
                image="valkey/valkey:8.1",
                container_port=6379,
                readiness_command=("valkey-cli", "ping"),
            )
            if container is not None:
                return container
            if requested == "podman":
                return None

    from testcontainers.community.valkey import ValkeyContainer

    return start_container(lambda: ValkeyContainer("valkey/valkey:8.1"))


def _run_podman(*args: str, check: bool = True) -> subprocess.CompletedProcess[str]:
    """Run Podman with a bounded wait so test startup cannot hang forever."""
    return subprocess.run(
        ["podman", *args],
        capture_output=True,
        check=check,
        text=True,
        timeout=30,
    )


def _start_windows_podman_postgres() -> WindowsPodmanContainer | None:
    """Start PostgreSQL through the reliable Windows Podman CLI transport."""
    return _start_windows_podman_container(
        image=POSTGRES_IMAGE,
        container_port=5432,
        environment=("POSTGRES_USER=admin", "POSTGRES_PASSWORD=admin"),
        readiness_command=("pg_isready", "--username", "admin"),
    )


def _start_windows_podman_container(
    *,
    image: str,
    container_port: int,
    environment: tuple[str, ...] = (),
    readiness_command: tuple[str, ...],
) -> WindowsPodmanContainer | None:
    """Start and readiness-check a disposable Podman container on Windows."""
    if shutil.which("podman") is None:
        return None

    image_name = image.replace("/", "-").replace(":", "-")
    name = f"mucgpt-test-{image_name}-{uuid4().hex}"
    try:
        run_args = [
            "run",
            "--detach",
            "--rm",
            "--name",
            name,
            "--publish",
            f"127.0.0.1::{container_port}",
        ]
        for value in environment:
            run_args.extend(("--env", value))
        run_args.append(image)
        _run_podman(*run_args)
        port_output = _run_podman("port", name, f"{container_port}/tcp").stdout.strip()
        port = _podman_published_port(port_output)
        deadline = time.monotonic() + 30
        while time.monotonic() < deadline:
            result = _run_podman("exec", name, *readiness_command, check=False)
            if result.returncode == 0:
                return WindowsPodmanContainer(name, port, container_port)
            time.sleep(0.25)
    except (OSError, subprocess.SubprocessError, ValueError):
        pass

    try:
        _run_podman("rm", "--force", name, check=False)
    except (OSError, subprocess.SubprocessError):
        pass
    return None


def _podman_published_port(output: str) -> int:
    """Extract the host port from ``podman port`` output."""
    for line in output.splitlines():
        host, separator, port = line.strip().rpartition(":")
        if separator and host and port.isdecimal():
            return int(port)
    raise ValueError(f"Podman did not report a published PostgreSQL port: {output!r}")


def start_container[TContainer: StartableContainer](
    factory: Callable[[], TContainer],
) -> TContainer | None:
    """Start a container via `factory()`, trying Docker and then Podman.

    Returns the started container, or None when no container runtime is
    reachable.
    """
    requested = os.getenv("MUCGPT_TEST_CONTAINER_RUNTIME", "auto").strip().lower()
    if requested in {"auto", "docker"}:
        container = _try_start(factory)
        if container is not None or requested == "docker":
            return container
    if requested not in {"auto", "podman"}:
        return None
    for socket in _podman_socket_candidates():
        if not socket.exists():
            continue
        helper_set_socket_override = configure_podman_runtime(socket)
        container = _try_start(factory)
        if container is not None:
            return container
        if helper_set_socket_override:
            os.environ.pop("TESTCONTAINERS_DOCKER_SOCKET_OVERRIDE", None)
    for pipe in _podman_pipe_candidates():
        configure_podman_pipe(pipe)
        container = _try_start(factory)
        if container is not None:
            return container
    return None


def _try_start[TContainer: StartableContainer](
    factory: Callable[[], TContainer],
) -> TContainer | None:
    container = None
    try:
        container = factory()
        container.start()
    except Exception:  # noqa: BLE001 — any runtime failure means "try next"
        if container is not None:
            try:
                container.stop()
            except Exception:  # noqa: BLE001 — cleanup must not block fallback
                pass
        return None
    return container


def postgres_engine_url(container: PostgresContainer) -> str:
    """SQLAlchemy asyncpg URL for a running PostgresContainer."""
    return (
        "postgresql+asyncpg://"
        f"{os.environ.get('MUCGPT_TEST_POSTGRES_USER', 'admin')}:"
        f"{os.environ.get('MUCGPT_TEST_POSTGRES_PASSWORD', 'admin')}"
        f"@{container.get_container_host_ip()}:{int(container.get_exposed_port(5432))}/postgres"
    )
