
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

```bash
# Add  package
uv add pydantic

### Remove Packages

Packages can also be removed.

```bash
# Remove package
uv remove pydantic
```

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
 git push origin tag mucgpt-frontend-<version>
 git push origin tag mucgpt-core-<version>
 git push origin tag mucgpt-assistant-<version>
 git push origin tag mucgpt-assistant-migrations-<version>
```

You can find the available versions under:

- Frontend: <https://github.com/it-at-m/mucgpt/pkgs/container/mucgpt%2Fmucgpt-frontend>
- Core: <https://github.com/it-at-m/mucgpt/pkgs/container/mucgpt%2Fmucgpt-core>
- Assistant: <https://github.com/it-at-m/mucgpt/pkgs/container/mucgpt%2Fmucgpt-assistant>
- Migrations: <https://github.com/it-at-m/mucgpt/pkgs/container/mucgpt%2Fmucgpt-assistant-migrations>
