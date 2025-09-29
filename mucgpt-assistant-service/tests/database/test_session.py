"""
Tests for database session handling, particularly password character issues and direct connection parameters.
"""

from unittest.mock import MagicMock, patch

import pytest
from src.config.settings import Settings
from src.database.session import (
    create_database_url,
    get_engine_and_factory_direct,
    validate_database_connection,
)


class TestDatabaseSession:
    """Test cases for database session handling with password character issues."""

    def test_create_database_url_simple_password(self):
        """Test URL creation with a simple password (no special characters)."""
        settings = Settings(
            DB_HOST="localhost",
            DB_PORT=5432,
            DB_NAME="testdb",
            DB_USER="testuser",
            DB_PASSWORD="simple123",
        )

        url = create_database_url(settings)

        assert url.drivername == "postgresql+asyncpg"
        assert url.username == "testuser"
        assert url.password == "simple123"  # Password preserved as-is
        assert url.host == "localhost"
        assert url.port == 5432
        assert url.database == "testdb"

    def test_create_database_url_special_characters(self):
        """Test URL creation with special characters (preserved as-is with direct approach)."""
        settings = Settings(
            DB_HOST="localhost",
            DB_PORT=5432,
            DB_NAME="testdb",
            DB_USER="testuser",
            DB_PASSWORD="Ay#W-67CQt)y8f'3",  # User's actual problematic password
        )

        url = create_database_url(settings)

        assert url.drivername == "postgresql+asyncpg"
        assert url.username == "testuser"
        assert url.password == "Ay#W-67CQt)y8f'3"  # Password preserved exactly as-is
        assert url.host == "localhost"
        assert url.port == 5432
        assert url.database == "testdb"

    def test_create_database_url_empty_password(self):
        """Test URL creation with empty password."""
        settings = Settings(
            DB_HOST="localhost",
            DB_PORT=5432,
            DB_NAME="testdb",
            DB_USER="testuser",
            DB_PASSWORD="",
        )

        url = create_database_url(settings)

        # Empty password should remain empty
        assert url.password == ""

    @pytest.mark.parametrize(
        "password",
        [
            "simple123",
            "pass'word",  # Single quote
            "pass#word",  # Hash
            "user@pass",  # At symbol
            "pass/word",  # Forward slash
            "pass\\word",  # Backslash
            "pass?word",  # Question mark
            "pass&word",  # Ampersand
            "pass%word",  # Percent
            "pass:word",  # Colon
            "pass;word",  # Semicolon
            "my password",  # Space
            "pass)word",  # Parenthesis
            "pass-word",  # Dash
            "pass_word",  # Underscore
            "Ay#W-67CQt)y8f'3",  # User's actual password
        ],
    )
    def test_direct_connection_preserves_passwords(self, password):
        """Test that direct connection approach preserves all password characters exactly."""
        settings = Settings(
            DB_HOST="localhost",
            DB_PORT=5432,
            DB_NAME="testdb",
            DB_USER="testuser",
            DB_PASSWORD=password,
        )

        url = create_database_url(settings)
        # With direct approach, password should be preserved exactly as-is
        assert url.password == password

    @patch("src.database.session.create_async_engine")
    @patch("src.database.session.async_sessionmaker")
    def test_get_engine_and_factory_direct_with_special_chars(
        self, mock_sessionmaker, mock_engine
    ):
        """Test direct connection factory with special characters in password."""
        settings = Settings(
            DB_HOST="localhost",
            DB_PORT=5432,
            DB_NAME="testdb",
            DB_USER="testuser",
            DB_PASSWORD="Ay#W-67CQt)y8f'3",  # User's problematic password
        )

        # Mock the engine and sessionmaker
        mock_engine_instance = MagicMock()
        mock_sessionmaker_instance = MagicMock()
        mock_engine.return_value = mock_engine_instance
        mock_sessionmaker.return_value = mock_sessionmaker_instance

        # Call the function
        engine, factory = get_engine_and_factory_direct(settings)

        # Verify engine was created with correct connection arguments
        mock_engine.assert_called_once()
        call_args = mock_engine.call_args

        # Check that connect_args contains the password exactly as provided
        connect_args = call_args[1]["connect_args"]
        assert connect_args["host"] == "localhost"
        assert connect_args["port"] == 5432
        assert connect_args["database"] == "testdb"
        assert connect_args["user"] == "testuser"
        assert connect_args["password"] == "Ay#W-67CQt)y8f'3"  # Exact password

        # Verify sessionmaker was called
        mock_sessionmaker.assert_called_once_with(mock_engine_instance)

    @pytest.mark.asyncio
    async def test_connection_test_with_special_chars(self):
        """Test database connection with special characters in password (mock)."""
        settings = Settings(
            DB_HOST="localhost",
            DB_PORT=5432,
            DB_NAME="testdb",
            DB_USER="testuser",
            DB_PASSWORD="Ay#W-67CQt)y8f'3",  # User's actual problematic password
        )

        # Mock the direct connection approach
        with patch(
            "src.database.session.get_engine_and_factory_direct"
        ) as mock_factory:
            # Create a proper async mock
            mock_session = MagicMock()
            mock_result = MagicMock()
            mock_result.fetchone.return_value = (1,)

            # Mock the execute method to return the result
            async def mock_execute(query):
                return mock_result

            mock_session.execute = mock_execute

            # Create async context manager
            class MockSessionManager:
                async def __aenter__(self):
                    return mock_session

                async def __aexit__(self, exc_type, exc_val, exc_tb):
                    return None

            mock_factory.return_value = (MagicMock(), lambda: MockSessionManager())

            # Test should pass with special characters in password
            result = await validate_database_connection(settings)
            assert result is True

    def test_problematic_characters_preserved(self):
        """Test that problematic characters are preserved as-is with direct connection approach."""
        problematic_passwords = [
            "test'quote",
            "test#hash",
            "test@symbol",
            "test/slash",
            "test\\backslash",
            "test?question",
            "test&ampersand",
            "test%percent",
            "test:colon",
            "test;semicolon",
            "Ay#W-67CQt)y8f'3",  # User's actual password
        ]

        for password in problematic_passwords:
            settings = Settings(
                DB_HOST="localhost",
                DB_PORT=5432,
                DB_NAME="testdb",
                DB_USER="testuser",
                DB_PASSWORD=password,
            )

            url = create_database_url(settings)

            # With direct approach, password should be preserved exactly
            assert url.password == password, (
                f"Password '{password}' should be preserved as-is"
            )

    def test_safe_characters_preserved(self):
        """Test that safe characters are preserved exactly as-is."""
        safe_passwords = [
            "simplepassword",
            "pass-word",
            "pass_word",
            "Password123",
            "test.password",
        ]

        for password in safe_passwords:
            settings = Settings(
                DB_HOST="localhost",
                DB_PORT=5432,
                DB_NAME="testdb",
                DB_USER="testuser",
                DB_PASSWORD=password,
            )

            url = create_database_url(settings)

            # Safe passwords should be preserved exactly
            assert url.password == password, (
                f"Safe password '{password}' should be preserved as-is"
            )
