from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from agent.agent import MUCGPTAgent
from agent.tools.tools import ToolCollection
from config.settings import Settings
from core.auth_models import AuthenticationResult
from init_app import ModelOptions, init_agent


class TestInitApp:
    """Tests for the init_app module functions."""

    def setup_method(self):
        """Set up test fixtures before each test method."""
        # Use a mock Settings object
        self.mock_settings = MagicMock(spec=Settings)
        self.mock_settings.MODELS = []
        self.mock_settings.VERSION = "1.0.0"

        # mock model
        self.mock_model = MagicMock()
        self.mock_agent = MagicMock(spec=MUCGPTAgent)

        # mock user
        self.mock_user = MagicMock(spec=AuthenticationResult)

        # mock tool_collection
        self.tool_collection = MagicMock(spec=ToolCollection)

    @pytest.mark.asyncio
    @patch("init_app._initialize_models_metadata")
    @patch("config.model_provider.ModelProvider.get_model")
    @patch("agent.tools.tools.ToolCollection")
    @patch("agent.agent.MUCGPTAgent")
    @patch("agent.agent_executor.MUCGPTAgentExecutor")
    async def test_init_agent_calls_correct_components(
            self,
            mock_executor,
            mock_agent,
            mock_toolcollection,
            mock_get_model,
            mock_init_metadata,
    ):
        # Arrange
        cfg = Settings()
        user_info = MagicMock()

        mock_model = MagicMock()
        mock_get_model.return_value = mock_model

        mock_tool_collection_instance = MagicMock()
        mock_tool_collection_instance.get_tools = AsyncMock(return_value=["t1", "t2"])
        mock_toolcollection.return_value = mock_tool_collection_instance

        mock_agent_instance = MagicMock()
        mock_agent.return_value = mock_agent_instance

        mock_executor_instance = MagicMock()
        mock_executor.return_value = mock_executor_instance

        # Act
        result = await init_agent(cfg, user_info)

        # Assert
        mock_init_metadata.assert_called_once_with(cfg)
        mock_get_model.assert_called_once()

        mock_toolcollection.assert_called_once_with(model=mock_model)
        mock_tool_collection_instance.get_tools.assert_awaited_once_with(user_info=user_info)

        mock_agent.assert_called_once()

        mock_executor.assert_called_once_with(agent=mock_agent_instance)

        assert result == mock_executor_instance

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
