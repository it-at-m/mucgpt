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
 git tag mucgpt-assistant-<version>
 git tag mucgpt-assistant-migrations-<version>
```

Then push to origin, one of the release workflows is then triggered

```bash
 git push origin mucgpt-frontend-<version>
 git push origin mucgpt-core-<version>
 git push origin mucgpt-assistant-<version>
 git push origin mucgpt-assistant-migrations-<version>
```

You can find the available versions under:

- Frontend: <https://github.com/it-at-m/mucgpt/pkgs/container/mucgpt%2Fmucgpt-frontend>
- Core: <https://github.com/it-at-m/mucgpt/pkgs/container/mucgpt%2Fmucgpt-core>
- Assistant: <https://github.com/it-at-m/mucgpt/pkgs/container/mucgpt%2Fmucgpt-assistant>
- Migrations: <https://github.com/it-at-m/mucgpt/pkgs/container/mucgpt%2Fmucgpt-assistant-migrations>

> Note: A new frontend tag will also create a new github pages deployment with the actual version
