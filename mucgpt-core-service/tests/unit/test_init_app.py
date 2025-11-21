from unittest.mock import MagicMock, patch

import pytest

from agent.agent import MUCGPTAgent
from agent.agent_executor import MUCGPTAgentExecutor
from config.settings import LangfuseSettings, Settings
from init_app import ModelOptions, init_agent, init_service


class TestInitApp:
    """Tests for the init_app module functions."""

    def setup_method(self):
        """Set up test fixtures before each test method."""
        # Use a mock Settings object
        self.mock_settings = MagicMock(spec=Settings)
        self.mock_settings.MODELS = []
        self.mock_settings.VERSION = "1.0.0"

        # Mock Langfuse settings
        self.mock_langfuse = MagicMock(spec=LangfuseSettings)
        self.mock_langfuse.HOST = "https://langfuse.example.com"
        self.mock_langfuse.PUBLIC_KEY = "test-public-key"
        self.mock_langfuse.SECRET_KEY = (
            "test-secret-key"  # Create a mock model and service
        )
        self.mock_model = MagicMock()
        self.mock_agent = MagicMock(spec=MUCGPTAgent)

    @patch("init_app.get_model")
    def test_init_service(self, mock_get_model):
        """Test the init_service function with default options."""
        # Arrange
        mock_get_model.return_value = self.mock_model

        # Act
        service = init_service(MUCGPTAgent, self.mock_settings)

        # Assert
        mock_get_model.assert_called_once()
        assert isinstance(service, MUCGPTAgent)

    @patch("init_app.get_model")
    def test_init_service_enriches_models(self, mock_get_model):
        """Ensure init_service populates model metadata before usage."""

        mock_get_model.return_value = self.mock_model
        model_entry = MagicMock()
        self.mock_settings.MODELS = [model_entry]

        with patch("init_app.enrich_model_metadata") as mock_enrich:
            init_service(MUCGPTAgent, self.mock_settings)

        mock_enrich.assert_called_once_with(model_entry)

    @patch("init_app.get_model")
    def test_init_service_with_custom_model(self, mock_get_model):
        """Test the init_service function with a custom model."""
        # Arrange
        custom_model = MagicMock()
        options = ModelOptions(custom_model=custom_model)

        # Act
        service = init_service(MUCGPTAgent, self.mock_settings, options=options)

        # Assert
        mock_get_model.assert_not_called()
        assert isinstance(service, MUCGPTAgent)

    @patch("init_app.get_model")
    def test_init_service_with_dict_options(self, mock_get_model):
        """Test the init_service function with options as dictionary."""
        # Arrange
        mock_get_model.return_value = self.mock_model
        options_dict = {"temperature": 0.5, "streaming": False}

        # Act
        service = init_service(MUCGPTAgent, self.mock_settings, options=options_dict)

        # Assert
        mock_get_model.assert_called_once()
        assert isinstance(service, MUCGPTAgent)
        # Verify options were passed correctly
        args, kwargs = mock_get_model.call_args
        assert kwargs["temperature"] == 0.5
        assert kwargs["streaming"] is False

    @patch("init_app.init_service")
    def test_init_agent(self, mock_init_service):
        """Test the init_agent function."""
        # Arrange
        mock_init_service.return_value = self.mock_agent

        # Act
        agent = init_agent(self.mock_settings, self.mock_langfuse)

        # Assert
        mock_init_service.assert_called_once()
        assert isinstance(agent, MUCGPTAgentExecutor)

    @patch("init_app.init_service")
    def test_init_agent_with_options(self, mock_init_service):
        """Test the init_agent function with custom options."""
        # Arrange
        mock_init_service.return_value = self.mock_agent
        options = {"temperature": 0.3, "max_tokens": 2000}

        # Act
        agent = init_agent(self.mock_settings, self.mock_langfuse, options=options)

        # Assert
        mock_init_service.assert_called_once()  # Verify options were passed
        args, kwargs = mock_init_service.call_args
        assert kwargs["options"] == options
        assert isinstance(agent, MUCGPTAgentExecutor)

    def test_model_options_validates_temperature_too_high(self):
        """Test that ModelOptions validates temperature is not too high."""
        # Act & Assert
        with pytest.raises(ValueError, match="Temperature must be between 0 and 1"):
            ModelOptions(temperature=1.5)

    def test_model_options_validates_temperature_too_low(self):
        """Test that ModelOptions validates temperature is not too low."""
        # Act & Assert
        with pytest.raises(ValueError, match="Temperature must be between 0 and 1"):
            ModelOptions(temperature=-0.1)

    def test_model_options_validates_max_tokens_zero(self):
        """Test that ModelOptions validates max_tokens is not zero."""
        # Act & Assert
        with pytest.raises(ValueError, match="Max tokens must be a positive integer"):
            ModelOptions(max_tokens=0)

    def test_model_options_validates_max_tokens_negative(self):
        """Test that ModelOptions validates max_tokens is not negative."""
        # Act & Assert
        with pytest.raises(ValueError, match="Max tokens must be a positive integer"):
            ModelOptions(max_tokens=-100)

    @patch("init_app.get_model")
    def test_init_service_with_valid_options(self, mock_get_model):
        """Test init_service with valid options."""
        # Arrange
        mock_get_model.return_value = self.mock_model
        options = ModelOptions(temperature=0.7, max_tokens=100)

        # Act
        service = init_service(MUCGPTAgent, self.mock_settings, options=options)

        # Assert
        assert isinstance(service, MUCGPTAgent)
        # Verify options were passed correctly
        args, kwargs = mock_get_model.call_args
        assert kwargs["temperature"] == 0.7
        assert kwargs["max_output_tokens"] == 100
