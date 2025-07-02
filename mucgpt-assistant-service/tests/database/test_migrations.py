"""Tests for database migrations.

This test suite validates the initial migration (0001_initial_migration.py) to ensure:
1. All required tables are created correctly
2. Table structures match the expected schema
3. Foreign key constraints are properly set up
4. Unique constraints are in place
5. Data can be inserted and retrieved
6. Alembic version tracking works
7. Migrations can be downgraded

The tests use a temporary SQLite database and a test-specific Alembic configuration
to avoid interfering with the main PostgreSQL database setup.
"""

import os
import shutil
import tempfile
from pathlib import Path

import pytest
from alembic import command
from alembic.config import Config
from sqlalchemy import create_engine, inspect, text


def create_isolated_alembic_environment():
    """Create a completely isolated Alembic environment in a temporary directory.

    This function creates a temporary directory and copies all necessary Alembic files
    to it, ensuring complete isolation from the production environment.

    Returns:
        tuple: Path to temp directory and path to the test script.py.mako file
    """
    # Create a temporary directory for our isolated Alembic environment
    temp_dir = tempfile.mkdtemp(prefix="alembic_test_")

    # Create versions subdirectory
    versions_dir = os.path.join(temp_dir, "versions")
    os.makedirs(versions_dir, exist_ok=True)

    # Get the path to the test directories
    project_root = Path(__file__).parent.parent.parent
    test_db_dir = os.path.join(project_root, "tests", "database")

    # Copy the test env.py to the temp directory
    test_env_path = os.path.join(test_db_dir, "env.py")
    temp_env_path = os.path.join(temp_dir, "env.py")
    shutil.copy2(test_env_path, temp_env_path)

    # Copy the migration script template
    script_mako_path = os.path.join(project_root, "migrations", "script.py.mako")
    temp_script_mako_path = os.path.join(temp_dir, "script.py.mako")

    if os.path.exists(script_mako_path):
        shutil.copy2(script_mako_path, temp_script_mako_path)
    else:
        # Create a minimal script.py.mako if the original doesn't exist
        template_content = '''"""${message}

Revision ID: ${up_revision}
Revises: ${down_revision | comma,n}
Create Date: ${create_date}

"""
from typing import Sequence, Union

import sqlalchemy as sa
${imports if imports else ""}

# revision identifiers, used by Alembic.
revision: str = '${up_revision}'
down_revision: Union[str, None] = ${down_revision}
branch_labels: Union[str, Sequence[str], None] = ${branch_labels}
depends_on: Union[str, Sequence[str], None] = ${depends_on}


def upgrade() -> None:
    ${upgrades if upgrades else "pass"}


def downgrade() -> None:
    ${downgrades if downgrades else "pass"}
'''
        with open(temp_script_mako_path, "w") as f:
            f.write(template_content)

    # Copy the migration file to the versions directory
    test_migration_path = os.path.join(
        test_db_dir, "versions", "0001_initial_migration.py"
    )
    temp_migration_path = os.path.join(versions_dir, "0001_initial_migration.py")
    shutil.copy2(test_migration_path, temp_migration_path)

    return temp_dir, temp_script_mako_path


class TestMigrations:
    """Test database migrations."""

    @pytest.fixture
    def temp_db_engine(self):
        """Create a temporary SQLite database for migration testing."""
        # Create a temporary file for the database
        temp_db = tempfile.NamedTemporaryFile(suffix=".db", delete=False)
        temp_db.close()

        db_url = f"sqlite:///{temp_db.name}"
        engine = create_engine(db_url, echo=False)

        yield engine, temp_db.name

        # Cleanup
        engine.dispose()
        os.unlink(temp_db.name)

    @pytest.fixture
    def alembic_config(self, temp_db_engine):
        """Create Alembic config pointing to temporary database with a fully isolated environment."""
        engine, db_path = temp_db_engine

        # Create a completely isolated Alembic environment
        temp_alembic_dir, temp_script_mako = create_isolated_alembic_environment()

        # Create a temporary alembic.ini that points to our isolated environment
        config_content = f"""
[alembic]
script_location = {temp_alembic_dir}
sqlalchemy.url = sqlite:///{db_path}
version_num_format = %%04d

[loggers]
keys = root,sqlalchemy,alembic

[handlers]
keys = console

[formatters]
keys = generic

[logger_root]
level = WARN
handlers = console
qualname =

[logger_sqlalchemy]
level = WARN
handlers =
qualname = sqlalchemy.engine

[logger_alembic]
level = INFO
handlers =
qualname = alembic

[handler_console]
class = StreamHandler
args = (sys.stderr,)
level = NOTSET
formatter = generic

[formatter_generic]
format = %(levelname)-5.5s [%(name)s] %(message)s
datefmt = %H:%M:%S
"""

        # Write temporary config file
        temp_config = tempfile.NamedTemporaryFile(mode="w", suffix=".ini", delete=False)
        temp_config.write(config_content)
        temp_config.close()

        config = Config(temp_config.name)

        yield config, engine, temp_alembic_dir

        # Cleanup
        os.unlink(temp_config.name)
        shutil.rmtree(temp_alembic_dir)

    @pytest.fixture
    def migrated_db(self, alembic_config):
        """Database with migrations applied."""
        config, engine, _ = alembic_config

        try:
            # Run migrations up to the first migration
            command.upgrade(config, "0001")

            yield engine
        except Exception as e:
            print(f"Migration failed: {e}")
            raise

    def test_initial_migration_creates_all_tables(self, migrated_db):
        """Test that the initial migration creates all required tables."""
        engine = migrated_db

        with engine.connect() as conn:
            # Check that all expected tables exist
            result = conn.execute(
                text("""
                SELECT name FROM sqlite_master
                WHERE type='table' AND name NOT LIKE 'alembic_%'
                ORDER BY name
            """)
            )

            tables = [row[0] for row in result.fetchall()]

            expected_tables = [
                "assistant_owners",
                "assistant_tools",
                "assistant_versions",
                "assistants",
                "owners",
            ]

            assert set(tables) == set(expected_tables), (
                f"Expected tables {expected_tables}, got {tables}"
            )

    def test_assistants_table_structure(self, migrated_db):
        """Test that the assistants table has the correct structure."""
        engine = migrated_db

        # Get table structure using sync inspector
        inspector = inspect(engine)
        columns = inspector.get_columns("assistants")

        # Check required columns exist
        column_names = [col["name"] for col in columns]
        expected_columns = ["id", "created_at", "updated_at", "hierarchical_access"]

        for col in expected_columns:
            assert col in column_names, f"Column '{col}' missing from assistants table"

        # Check primary key
        pk_columns = [col["name"] for col in columns if col.get("primary_key")]
        assert "id" in pk_columns, "id should be primary key"

    def test_assistant_versions_table_structure(self, migrated_db):
        """Test that the assistant_versions table has the correct structure."""
        engine = migrated_db

        inspector = inspect(engine)
        columns = inspector.get_columns("assistant_versions")

        column_names = [col["name"] for col in columns]
        expected_columns = [
            "id",
            "assistant_id",
            "version",
            "created_at",
            "name",
            "description",
            "system_prompt",
            "temperature",
            "max_output_tokens",
            "examples",
            "quick_prompts",
            "tags",
        ]

        for col in expected_columns:
            assert col in column_names, (
                f"Column '{col}' missing from assistant_versions table"
            )

    def test_foreign_key_constraints(self, migrated_db):
        """Test that foreign key constraints are properly set up."""
        engine = migrated_db

        inspector = inspect(engine)

        # Check assistant_versions -> assistants FK
        fk_constraints = inspector.get_foreign_keys("assistant_versions")
        assistant_fk = next(
            (fk for fk in fk_constraints if "assistants" in fk["referred_table"]), None
        )
        assert assistant_fk is not None, (
            "Foreign key from assistant_versions to assistants missing"
        )

        # Check assistant_owners -> assistants FK
        fk_constraints = inspector.get_foreign_keys("assistant_owners")
        fk_tables = [fk["referred_table"] for fk in fk_constraints]
        assert "assistants" in fk_tables, (
            "Foreign key from assistant_owners to assistants missing"
        )
        assert "owners" in fk_tables, (
            "Foreign key from assistant_owners to owners missing"
        )

    def test_unique_constraints(self, migrated_db):
        """Test that unique constraints are properly set up."""
        engine = migrated_db

        inspector = inspect(engine)

        # Check unique constraint on assistant_versions (assistant_id, version)
        unique_constraints = inspector.get_unique_constraints("assistant_versions")
        version_constraint = next(
            (uc for uc in unique_constraints if "uq_assistant_version" in uc["name"]),
            None,
        )
        assert version_constraint is not None, (
            "Unique constraint uq_assistant_version missing"
        )

        # Check unique constraint on assistant_owners (assistant_id, lhmobjektID)
        unique_constraints = inspector.get_unique_constraints("assistant_owners")
        owner_constraint = next(
            (uc for uc in unique_constraints if "uq_assistant_owner" in uc["name"]),
            None,
        )
        assert owner_constraint is not None, (
            "Unique constraint uq_assistant_owner missing"
        )

    def test_migration_can_insert_data(self, migrated_db):
        """Test that we can insert data into the migrated tables."""
        engine = migrated_db

        with engine.connect() as conn:
            # Insert test data
            conn.execute(
                text("""
                INSERT INTO owners (lhmobjektID) VALUES ('test-user-1')
            """)
            )

            conn.execute(
                text("""
                INSERT INTO assistants (id, created_at, updated_at, hierarchical_access)
                VALUES ('test-assistant-1', datetime('now'), datetime('now'), '[]')
            """)
            )

            conn.execute(
                text("""
                INSERT INTO assistant_versions (
                    assistant_id, version, created_at, name, system_prompt,
                    temperature, max_output_tokens
                ) VALUES (
                    'test-assistant-1', 1, datetime('now'), 'Test Assistant',
                    'You are helpful', 0.7, 1000
                )
            """)
            )

            conn.execute(
                text("""
                INSERT INTO assistant_owners (assistant_id, lhmobjektID)
                VALUES ('test-assistant-1', 'test-user-1')
            """)
            )

            conn.commit()

            # Verify data was inserted
            result = conn.execute(text("SELECT COUNT(*) FROM assistants"))
            assert result.scalar() == 1

            result = conn.execute(text("SELECT COUNT(*) FROM assistant_versions"))
            assert result.scalar() == 1

            result = conn.execute(text("SELECT COUNT(*) FROM owners"))
            assert result.scalar() == 1

            result = conn.execute(text("SELECT COUNT(*) FROM assistant_owners"))
            assert result.scalar() == 1

    def test_migration_version_tracking(self, alembic_config):
        """Test that Alembic properly tracks migration versions."""
        config, engine, _ = alembic_config

        # Apply migration
        command.upgrade(config, "0001")

        with engine.connect() as conn:
            # Check that alembic_version table exists and has correct version
            result = conn.execute(text("SELECT version_num FROM alembic_version"))
            version = result.scalar()
            assert version == "0001", f"Expected version 0001, got {version}"

    def test_migration_downgrade(self, alembic_config):
        """Test that we can downgrade the migration."""
        config, engine, _ = alembic_config

        # Apply migration
        command.upgrade(config, "0001")

        # Verify tables exist
        with engine.connect() as conn:
            result = conn.execute(
                text("""
                SELECT name FROM sqlite_master
                WHERE type='table' AND name='assistants'
            """)
            )
            assert result.scalar() == "assistants"

        # Downgrade
        command.downgrade(config, "base")

        # Verify tables are gone
        with engine.connect() as conn:
            result = conn.execute(
                text("""
                SELECT name FROM sqlite_master
                WHERE type='table' AND name='assistants'
            """)
            )
            assert result.scalar() is None
