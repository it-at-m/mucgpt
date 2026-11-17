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

## Linting

```bash
uv run ruff check
# and fixing
uv run ruff check --fix
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


## Third-party licenses

Policy lives in the root `pyproject.toml` under `[tool.licensecheck]`: a minimal
`allowed` list, accepted `warn` licenses and per-package `exceptions`
(`license`, `version`, `reason`). New licenses must be reviewed before being added.

`.github/workflows/license-check.yaml` runs the check on every pull request:
shipped dependencies fail on unapproved/unknown licenses, dev-only dependencies
only warn.

```bash
# Check all targets (or --targets mucgpt-core-service)
uv run python scripts/licenses/check_licenses.py

# Generate the third-party notices (THIRD_PARTY_LICENSES/ per target)
uv run python scripts/licenses/collect_licenses.py
```

Python service images generate the same `THIRD_PARTY_LICENSES/` layout at build
time using `scripts/licenses/image_notices.py` (core, assistant and both
migration images), which is shared with the collector. It is provided to the
per-service build contexts as the `licensescripts` additional build context;
direct builds need
`podman build --build-context licensescripts=.. -f mucgpt-core-service/Dockerfile mucgpt-core-service`.
The frontend image generates the notices of its bundled (production) npm
dependencies in the builder stage and ships them under
`/usr/share/licenses/mucgpt-frontend/THIRD_PARTY_LICENSES/` (not web-served).

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
