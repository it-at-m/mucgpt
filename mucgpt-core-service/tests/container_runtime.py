"""Container-runtime detection and lifecycle for testcontainers-based tests.

Prefers the already-configured Docker endpoint; otherwise falls back to the
Podman API socket, because Podman is the preferred local container runtime
(see stack/README.md). testcontainers talks to the Docker-compatible Podman
API via docker-py (DOCKER_HOST); Ryuk additionally needs the socket mounted
at the same path (TESTCONTAINERS_DOCKER_SOCKET_OVERRIDE).

Knobs:
- MUCGPT_TEST_CONTAINER_RUNTIME=auto|docker|podman (default auto)
- MUCGPT_TEST_POSTGRES=off disables PostgreSQL-based tests entirely.
"""

import os
from collections.abc import Callable
from pathlib import Path
from typing import TYPE_CHECKING, TypeVar

if TYPE_CHECKING:
    from testcontainers.postgres import PostgresContainer

TContainer = TypeVar("TContainer")

POSTGRES_IMAGE = "postgres:17.4"


def _podman_socket_candidates() -> list[Path]:
    """Sockets where a rootless/rootful Podman API service may listen."""
    candidates: list[Path] = []
    if xdg_runtime_dir := os.environ.get("XDG_RUNTIME_DIR"):
        candidates.append(Path(xdg_runtime_dir) / "podman" / "podman.sock")
    if getuid := getattr(os, "getuid", None):
        candidates.append(Path(f"/run/user/{getuid()}/podman/podman.sock"))
    candidates.append(Path("/run/podman/podman.sock"))
    return candidates


def configure_podman_runtime(socket: Path) -> None:
    os.environ["DOCKER_HOST"] = f"unix://{socket}"
    os.environ.setdefault("TESTCONTAINERS_DOCKER_SOCKET_OVERRIDE", str(socket))


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
        return any(socket.exists() for socket in _podman_socket_candidates())
    return True


def start_postgres_container() -> PostgresContainer | None:
    """Start a throwaway PostgreSQL server, trying Docker and then Podman.

    Returns the started container, or None when no container runtime is
    reachable. Raises on import errors (dependency missing).
    """
    from testcontainers.postgres import PostgresContainer

    return start_container(
        lambda: PostgresContainer(POSTGRES_IMAGE, username="admin", password="admin")
    )


def start_container(factory: Callable[[], TContainer]) -> TContainer | None:
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
        configure_podman_runtime(socket)
        container = _try_start(factory)
        if container is not None:
            return container
    return None


def _try_start(factory: Callable[[], TContainer]) -> TContainer | None:
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
