"""
Tests for database session handling, particularly password character issues and URL encoding.
"""

from unittest.mock import MagicMock, patch
from urllib.parse import quote_plus

import pytest
from src.config.settings import Settings
from src.database.session import create_database_url, validate_database_connection


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
        assert url.password == "simple123"  # Should not be encoded
        assert url.host == "localhost"
        assert url.port == 5432
        assert url.database == "testdb"

    def test_create_database_url_with_single_quote(self):
        """Test URL creation with password containing single quote."""
        settings = Settings(
            DB_HOST="localhost",
            DB_PORT=5432,
            DB_NAME="testdb",
            DB_USER="testuser",
            DB_PASSWORD="pass'word",
        )

        url = create_database_url(settings)

        # Password should be URL encoded
        expected_encoded = quote_plus("pass'word")
        assert url.password == expected_encoded
        assert url.password == "pass%27word"

    def test_create_database_url_with_hash(self):
        """Test URL creation with password containing hash character."""
        settings = Settings(
            DB_HOST="localhost",
            DB_PORT=5432,
            DB_NAME="testdb",
            DB_USER="testuser",
            DB_PASSWORD="pass#word",
        )

        url = create_database_url(settings)

        # Password should be URL encoded
        expected_encoded = quote_plus("pass#word")
        assert url.password == expected_encoded
        assert url.password == "pass%23word"

    def test_create_database_url_with_at_symbol(self):
        """Test URL creation with password containing @ symbol."""
        settings = Settings(
            DB_HOST="localhost",
            DB_PORT=5432,
            DB_NAME="testdb",
            DB_USER="testuser",
            DB_PASSWORD="user@pass",
        )

        url = create_database_url(settings)

        # Password should be URL encoded
        expected_encoded = quote_plus("user@pass")
        assert url.password == expected_encoded
        assert url.password == "user%40pass"

    def test_create_database_url_with_multiple_special_chars(self):
        """Test URL creation with password containing multiple problematic characters."""
        settings = Settings(
            DB_HOST="localhost",
            DB_PORT=5432,
            DB_NAME="testdb",
            DB_USER="testuser",
            DB_PASSWORD="pa's#@rd",
        )

        url = create_database_url(settings)

        # Password should be URL encoded
        expected_encoded = quote_plus("pa's#@rd")
        assert url.password == expected_encoded
        assert url.password == "pa%27s%23%40rd"

    def test_create_database_url_with_safe_characters(self):
        """Test URL creation with password containing generally safe characters."""
        settings = Settings(
            DB_HOST="localhost",
            DB_PORT=5432,
            DB_NAME="testdb",
            DB_USER="testuser",
            DB_PASSWORD="pass-word_123",
        )

        url = create_database_url(settings)

        # Password should not need encoding
        assert url.password == "pass-word_123"

    def test_create_database_url_with_space(self):
        """Test URL creation with password containing space."""
        settings = Settings(
            DB_HOST="localhost",
            DB_PORT=5432,
            DB_NAME="testdb",
            DB_USER="testuser",
            DB_PASSWORD="my password",
        )

        url = create_database_url(settings)

        # Password should be URL encoded (space becomes +)
        expected_encoded = quote_plus("my password")
        assert url.password == expected_encoded
        assert url.password == "my+password"

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
        "password,expected_encoded",
        [
            ("simple123", "simple123"),
            ("pass'word", "pass%27word"),
            ("pass#word", "pass%23word"),
            ("user@pass", "user%40pass"),
            ("pass/word", "pass%2Fword"),
            ("pass\\word", "pass%5Cword"),
            ("pass?word", "pass%3Fword"),
            ("pass&word", "pass%26word"),
            ("pass%word", "pass%25word"),
            ("pass:word", "pass%3Aword"),
            ("pass;word", "pass%3Bword"),
            ("my password", "my+password"),
            ("pass)word", "pass%29word"),
            ("pass-word", "pass-word"),  # Safe character
            ("pass_word", "pass_word"),  # Safe character
        ],
    )
    def test_password_encoding_scenarios(self, password, expected_encoded):
        """Test various password encoding scenarios."""
        settings = Settings(
            DB_HOST="localhost",
            DB_PORT=5432,
            DB_NAME="testdb",
            DB_USER="testuser",
            DB_PASSWORD=password,
        )

        url = create_database_url(settings)
        assert url.password == expected_encoded

    @pytest.mark.asyncio
    async def test_connection_test_with_encoded_password(self):
        """Test database connection with encoded password (mock)."""
        settings = Settings(
            DB_HOST="localhost",
            DB_PORT=5432,
            DB_NAME="testdb",
            DB_USER="testuser",
            DB_PASSWORD="test'#@pass",
        )

        # Mock the database connection
        with patch("src.database.session.get_engine_and_factory") as mock_factory:
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

            # Test should pass with encoded password
            result = await validate_database_connection(settings)
            assert result is True

    def test_problematic_characters_detection(self):
        """Test that problematic characters are properly detected during URL creation."""
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

            # Verify that the password was encoded (changed from original)
            assert url.password != password, (
                f"Password '{password}' should have been encoded"
            )

            # Verify it matches the expected URL encoding
            expected = quote_plus(password)
            assert url.password == expected, f"Password '{password}' encoding mismatch"

    def test_safe_characters_not_encoded(self):
        """Test that safe characters are not unnecessarily encoded."""
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

            # Safe passwords should not be changed
            assert url.password == password, (
                f"Safe password '{password}' should not be encoded"
            )
