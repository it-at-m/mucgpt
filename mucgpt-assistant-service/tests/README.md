# Repository Unit Tests

This directory contains comprehensive unit tests for the repository classes in the mucgpt-assistant-service.

## Test Structure

- `tests/database/test_repo.py` - Unit tests for the base `Repository` class
- `tests/database/test_assistant_repo.py` - Unit tests for the `AssistantRepository` class
- `tests/conftest.py` - Shared test fixtures and configuration

## Type-Safe Test Fixtures

The test suite uses the actual SQLAlchemy models for better type safety and IDE support:

### AssistantVersion Model Instance
The `sample_assistant_version_data` fixture returns an actual `AssistantVersion` SQLAlchemy model instance instead of a plain dictionary. This provides:

- **Type Safety**: Full typing support using the actual model class
- **IDE Support**: Auto-completion and type checking in your IDE
- **Model Consistency**: Tests use the same models as production code
- **Better Documentation**: Clear field definitions with SQLAlchemy column types

**Usage Example:**
```python
def test_example(sample_assistant_version_data):
    # Type-safe access to properties
    assert sample_assistant_version_data.name == "Test Assistant"
    assert sample_assistant_version_data.temperature == 0.7

    # Convert to dict for function calls using the to_dict() method
    version = repo.create_assistant_version(**sample_assistant_version_data.to_dict())

    # Create new instances for modified copies
    modified_data = AssistantVersion(
        name="New Name",
        system_prompt=sample_assistant_version_data.system_prompt,
        # ... other fields
    )
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
