from unittest.mock import MagicMock, patch

import pytest

from chat.agent import MUCGPTAgent, MUCGPTAgentRunner
from config.settings import BackendConfig
from init_app import init_agent, init_service


class TestInitApp:
    """Tests for the init_app module functions."""

    def setup_method(self):
        """Set up test fixtures before each test method."""
        # Create a mock backend config
        self.mock_config = MagicMock(spec=BackendConfig)
        self.mock_config.models = []

        # Create a mock model and service
        self.mock_model = MagicMock()
        self.mock_agent = MagicMock(spec=MUCGPTAgent)

    @patch("init_app.get_model")
    def test_init_service(self, mock_get_model):
        """Test the init_service function with default model."""
        # Arrange
        mock_get_model.return_value = self.mock_model

        # Act
        service = init_service(MUCGPTAgent, self.mock_config)

        # Assert
        mock_get_model.assert_called_once()
        assert isinstance(service, MUCGPTAgent)
        assert service.model == self.mock_model

    @patch("init_app.get_model")
    def test_init_service_with_custom_model(self, mock_get_model):
        """Test the init_service function with a custom model."""
        # Arrange
        custom_model = MagicMock()

        # Act
        service = init_service(MUCGPTAgent, self.mock_config, custom_model=custom_model)

        # Assert
        mock_get_model.assert_not_called()
        assert isinstance(service, MUCGPTAgent)
        assert service.model == custom_model

    @patch("init_app.init_service")
    def test_init_agent(self, mock_init_service):
        """Test the init_agent function."""
        # Arrange
        mock_init_service.return_value = self.mock_agent

        # Act
        service = init_agent(self.mock_config)

        # Assert
        mock_init_service.assert_called_once_with(
            MUCGPTAgent,
            self.mock_config,
            streaming=True,
            temperature=0.7,
            max_tokens=4000,
            custom_model=None,
        )

        assert isinstance(service, MUCGPTAgentRunner)

    def test_init_service_validates_temperature_too_high(self):
        """Test that init_service validates temperature is not too high."""
        # Act & Assert
        with pytest.raises(ValueError, match="Temperature must be between 0 and 1"):
            init_service(MUCGPTAgent, self.mock_config, temperature=1.5)

    def test_init_service_validates_temperature_too_low(self):
        """Test that init_service validates temperature is not too low."""
        # Act & Assert
        with pytest.raises(ValueError, match="Temperature must be between 0 and 1"):
            init_service(MUCGPTAgent, self.mock_config, temperature=-0.1)

    def test_init_service_validates_max_tokens_zero(self):
        """Test that init_service validates max_tokens is not zero."""
        # Act & Assert
        with pytest.raises(ValueError, match="Max tokens must be a positive integer"):
            init_service(MUCGPTAgent, self.mock_config, max_tokens=0)

    def test_init_service_validates_max_tokens_negative(self):
        """Test that init_service validates max_tokens is not negative."""
        # Act & Assert
        with pytest.raises(ValueError, match="Max tokens must be a positive integer"):
            init_service(MUCGPTAgent, self.mock_config, max_tokens=-100)

    @patch("init_app.get_model")
    def test_init_service_with_valid_parameters(self, mock_get_model):
        """Test init_service with valid temperature and max_tokens."""
        # Arrange
        mock_get_model.return_value = self.mock_model

        # Act
        service = init_service(
            MUCGPTAgent, self.mock_config, temperature=0.7, max_tokens=100
        )

        # Assert
        assert isinstance(service, MUCGPTAgent)
