
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
