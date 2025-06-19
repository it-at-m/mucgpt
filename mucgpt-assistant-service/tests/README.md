# Repository Unit Tests

This directory contains comprehensive unit tests for the repository classes in the mucgpt-assistant-service.

## Test Structure

- `tests/database/test_repo.py` - Unit tests for the base `Repository` class
- `tests/database/test_assistant_repo.py` - Unit tests for the `AssistantRepository` class
- `tests/conftest.py` - Shared test fixtures and configuration

## Type-Safe Test Fixtures

The test suite uses modern Python features for better type safety and IDE support:

### AssistantVersionTestData Dataclass
The `sample_assistant_version_data` fixture returns a typed dataclass (`AssistantVersionTestData`) instead of a plain dictionary. This provides:

- **Type Safety**: Full typing support with proper field types
- **IDE Support**: Auto-completion and type checking in your IDE
- **Immutable Updates**: Use `dataclasses.replace()` for creating modified copies
- **Better Documentation**: Clear field definitions with default values

**Usage Example:**
```python
def test_example(sample_assistant_version_data):
    # Type-safe access to properties
    assert sample_assistant_version_data.name == "Test Assistant"
    assert sample_assistant_version_data.temperature == 0.7

    # Convert to dict for function calls
    version = repo.create_assistant_version(**sample_assistant_version_data.to_dict())

    # Create modified copies immutably
    modified_data = replace(sample_assistant_version_data, name="New Name")
```

## Test Coverage

### Base Repository (`test_repo.py`)
- ✅ Creating new entities
- ✅ Retrieving entities by ID
- ✅ Retrieving all entities
- ✅ Updating existing entities (full and partial updates)
- ✅ Deleting entities
- ✅ Session state management

### Assistant Repository (`test_assistant_repo.py`)
- ✅ Creating assistants with and without owners
- ✅ Handling existing and new owners
- ✅ Updating assistant properties (hierarchical access, owners)
- ✅ Creating and managing assistant versions
- ✅ Hierarchical department access control
- ✅ Owner-based assistant filtering
- ✅ Business logic methods (is_owner, is_allowed_for_user)

## Running Tests

### Run all tests:
```bash
uv run pytest tests/ -v
```

### Run specific test files:
```bash
# Base repository tests only
uv run pytest tests/database/test_repo.py -v

# Assistant repository tests only
uv run pytest tests/database/test_assistant_repo.py -v
```

### Run tests with coverage:
```bash
uv run pytest tests/ --cov=src --cov-report=html
```

## Test Database

Tests use an in-memory SQLite database that is created fresh for each test, ensuring test isolation and fast execution.

## Dependencies

The tests require:
- `pytest` - Test framework
- `pytest-cov` - Coverage reporting
- `pytest-mock` - Mocking utilities
- `sqlalchemy` - Database ORM

These are automatically installed when running `uv sync`.
