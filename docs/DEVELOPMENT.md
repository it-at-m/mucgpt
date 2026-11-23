## Run

```shell
# Start frontend with API mocking
# inside /mucgpt-frontend
npm run dev
# Start frontend using container stack for API
# inside /mucgpt-frontend
npm run dev-no-mock
# Start stack with local running services
# inside /stack
podman compose -f docker-compose.yml -f docker-compose.dev.yml up
```

## Working with UV

### Synchronize / Update Packages

In existing projects, the collected dependencies can be synchronized or updated with a single command.

```bash
# Synchronize packages
uv sync --all-extras

# Update packages
uv lock -U
```

Install pre-commit hooks

```bash
 uv run pre-commit install
```

### Add Packages

Packages can be added using the following command

````bash
# Add  package
uv add pydantic

### Remove Packages

Packages can also be removed.

```bash
# Remove package
uv remove pydantic
````

## Running tests

```bash
uv run pytest
```

### Real PostgreSQL in tests via Testcontainers

The core-service opt-in lifecycle tests (`tests/integration/test_*_postgres.py`) and
the assistant-service database tests (`tests/database/`, parameterized `postgres` runs)
can use [Testcontainers](https://testcontainers.com) with a throwaway `postgres:17.4`
container. Their behavior differs:

- Core: when `MUCGPT_LIFECYCLE_POSTGRES_HOST` is set (as in CI), tests use that
  server and do so even when `MUCGPT_TEST_POSTGRES=off`. Otherwise,
  `MUCGPT_TEST_POSTGRES=off` prevents container startup and the affected tests skip.
- Assistant: the database fixture ignores `MUCGPT_LIFECYCLE_POSTGRES_HOST`; it
  starts a container when available, or omits PostgreSQL parameterized runs when
  container tests are disabled or no runtime is detected. Assistant tests may not
  use the configured lifecycle PostgreSQL server.
- otherwise: a container starts automatically when a container runtime is reachable.
  Docker is tried first, then the Podman API socket (rootless before rootful) —
  Podman is the preferred local runtime; the socket service must be enabled
  (`systemctl --user enable --now podman.socket`).
- `MUCGPT_TEST_CONTAINER_RUNTIME=docker|podman` forces one runtime.
- No container runtime reachable: the affected tests skip gracefully; nothing fails.

Coverage gates are enforced on full-suite runs (`--cov-fail-under` in each
service's `pyproject.toml` addopts and `thresholds` in the frontend's
`vitest.config.ts`; partial runs like `pytest tests/unit` skip the gate). If you
add code, raise the floor instead of lowering it.

```bash
# Frontend (inside mucgpt-frontend/) — runs tests with coverage and thresholds
npm run test
```

## Analyze a Langfuse trace

The core service includes a diagnostic script for investigating a single trace.
It prints a chronological observation timeline, including model, finish reason,
tool calls, and an explicit `CONTENT_FILTERED` marker when the provider stops a
generation with `content_filter` or `content_policy_violation`.

Run it from `mucgpt-core-service/`:

```bash
uv run python app/scripts/analyze_langfuse_trace.py <trace-id>
```

The script uses the legacy Langfuse v3 trace API by default. For Langfuse v4,
select the supported Observations API v2 explicitly:

```bash
uv run python app/scripts/analyze_langfuse_trace.py <trace-id> --api-version v4
```

The v4 path retrieves observations for the trace in a bounded seven-day window
and follows cursor pagination. Set `--from-start-time` and `--to-start-time`
with timezone-aware ISO-8601 timestamps when the trace is outside that window.

Credentials are read from `LANGFUSE_PUBLIC_KEY`, `LANGFUSE_SECRET_KEY`, and
`LANGFUSE_HOST`. When those variables are not already in the shell, the script
loads `stack/.env` by default. Use `--env-file <path>` to select a different
dotenv file.

The default report excludes observation inputs and outputs, which can contain
user data. Inspect bounded content only in an approved environment:

```bash
uv run python app/scripts/analyze_langfuse_trace.py <trace-id> --show-content
```

Use `--max-content-chars <n>` to change the default 500-character content
limit. The v3 option is retained for self-hosted v3 compatibility; v4
deployments must use `--api-version v4`.

## Linting

```bash
uv run ruff check
# and fixing
uv run ruff check --fix
```

## Type checking

Each Python service is type-checked with [ty](https://docs.astral.sh/ty/) (dev dependency, pinned in the service's `pyproject.toml`). CI and pre-commit run `uv run ty check` as separate required checks per service. The checks cover application, test, and migration code. Keep the checked code clean — if a library stub is looser than runtime reality, prefer narrowing or a `cast` and use a targeted `# ty: ignore[<rule>]` comment (with a short explanation) only as a last resort.

```bash
uv run ty check
```

## Build new images

First create a tag (decide which one is needed)

```bash
 git tag mucgpt-frontend-<version>
 git tag mucgpt-core-<version>
 git tag mucgpt-core-migrations-<version>
 git tag mucgpt-assistant-<version>
 git tag mucgpt-assistant-migrations-<version>
```

Then push to origin, one of the release workflows is then triggered

```bash
 git push origin mucgpt-frontend-<version>
 git push origin mucgpt-core-<version>
 git push origin mucgpt-core-migrations-<version>
 git push origin mucgpt-assistant-<version>
 git push origin mucgpt-assistant-migrations-<version>
```

You can find the available versions under:

- Frontend: <https://github.com/it-at-m/mucgpt/pkgs/container/mucgpt%2Fmucgpt-frontend>
- Core: <https://github.com/it-at-m/mucgpt/pkgs/container/mucgpt%2Fmucgpt-core>
- Core migrations: <https://github.com/it-at-m/mucgpt/pkgs/container/mucgpt%2Fmucgpt-core-migrations>
- Assistant: <https://github.com/it-at-m/mucgpt/pkgs/container/mucgpt%2Fmucgpt-assistant>
- Migrations: <https://github.com/it-at-m/mucgpt/pkgs/container/mucgpt%2Fmucgpt-assistant-migrations>

Every release image is also mirrored to the openCode container registry (GitLab registry of gitlab.opencode.de):

- Frontend: `registry.opencode.de/landeshauptstadt-muenchen/mucgpt/mucgpt-frontend`
- Core: `registry.opencode.de/landeshauptstadt-muenchen/mucgpt/mucgpt-core`
- Core migrations: `registry.opencode.de/landeshauptstadt-muenchen/mucgpt/mucgpt-core-migrations`
- Assistant: `registry.opencode.de/landeshauptstadt-muenchen/mucgpt/mucgpt-assistant`
- Migrations: `registry.opencode.de/landeshauptstadt-muenchen/mucgpt/mucgpt-assistant-migrations`

Both registries carry the same tags (`<version>` and `latest`) and the same runnable platform images. The openCode mirror omits GHCR-only BuildKit attestations because its registry does not accept them. If the openCode push fails, the GitHub release still succeeds (the mirror step tolerates errors); re-running the release workflow for the same tag retries the mirror.

> Note: A new frontend tag will also create a new github pages deployment with the actual version


## MCP credential handling security note

MCP source credentials and auth overrides are modeled as secret types in configuration to
reduce accidental plaintext exposure in config representation and normal app logging.

However, for outbound MCP calls the credentials are materialized into HTTP headers at
runtime. This means the implementation does **not** guarantee secrecy against host/runtime
inspection (e.g., process memory inspection, crash dumps, verbose HTTP client logging,
reverse-proxy/request logging, or packet capture at TLS termination boundaries).

Treat this mechanism as **log/config leak reduction**, not full runtime confidentiality.
For production, keep HTTP client logs non-verbose, avoid logging request objects, and
restrict access to host-level observability and diagnostics.
