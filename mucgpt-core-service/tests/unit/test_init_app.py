from unittest.mock import MagicMock, patch

import pytest

from chat.chat import Chat
from config.settings import BackendConfig
from init_app import init_chat_service, init_service


@pytest.fixture
def mock_config():
    """Create a mock backend config."""
    config = MagicMock(spec=BackendConfig)
    config.models = []
    return config


@patch("init_app.get_model")
def test_init_service(mock_get_model, mock_config):
    """Test the init_service function."""
    # Arrange
    mock_model = MagicMock()
    mock_get_model.return_value = mock_model

    # Act
    service = init_service(Chat, mock_config)

    # Assert
    mock_get_model.assert_called_once()
    assert isinstance(service, Chat)
    assert service.llm == mock_model


@patch("init_app.get_model")
def test_init_service_with_custom_model(mock_get_model, mock_config):
    """Test the init_service function with a custom model."""
    # Arrange
    custom_model = MagicMock()

    # Act
    service = init_service(Chat, mock_config, custom_model=custom_model)

    # Assert
    mock_get_model.assert_not_called()
    assert isinstance(service, Chat)
    assert service.llm == custom_model


@patch("init_app.init_service")
def test_init_chat_service(mock_init_service, mock_config):
    """Test the init_chat_service function."""
    # Arrange
    mock_chat = MagicMock(spec=Chat)
    mock_init_service.return_value = mock_chat

    # Act
    service = init_chat_service(mock_config)

    # Assert
    mock_init_service.assert_called_once()
    assert service == mock_chat


def test_init_service_validates_temperature(mock_config):
    """Test that init_service validates temperature."""

    # Act & Assert
    with pytest.raises(ValueError, match="Temperature must be between 0 and 1"):
        init_service(Chat, mock_config, temperature=1.5)

    with pytest.raises(ValueError, match="Temperature must be between 0 and 1"):
        init_service(Chat, mock_config, temperature=-0.1)


def test_init_service_validates_max_tokens(mock_config):
    """Test that init_service validates max_tokens."""

    # Act & Assert
    with pytest.raises(ValueError, match="Max tokens must be a positive integer"):
        init_service(Chat, mock_config, max_tokens=0)

    with pytest.raises(ValueError, match="Max tokens must be a positive integer"):
        init_service(Chat, mock_config, max_tokens=-100)
