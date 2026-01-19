from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from agent.agent import MUCGPTAgent
from agent.agent_executor import MUCGPTAgentExecutor
from agent.tools.tools import ToolCollection
from core.auth_models import AuthenticationResult
from init_app import ModelOptions, init_agent


class TestInitApp:
    """Tests for the init_app module functions."""

    def setup_method(self):
        """Set up test fixtures before each test method."""
        # mock model
        self.mock_model = MagicMock()
        self.mock_agent = MagicMock(spec=MUCGPTAgent)

        # mock user
        self.mock_user = MagicMock(spec=AuthenticationResult)

        # mock tool_collection
        self.tool_collection = MagicMock(spec=ToolCollection)

    @pytest.mark.asyncio
    @patch("config.model_provider.ModelProvider.get_model")
    @patch("agent.tools.tools.ToolCollection.get_tools", new_callable=AsyncMock)
    async def test_init_agent_calls_correct_components(
            self,
            mock_get_tools,
            mock_get_model,
    ):
        # Arrange
        mock_get_model.return_value = self.mock_model
        mock_get_tools.return_value = []

        # Act
        result = await init_agent(self.mock_user)

        # Assert
        mock_get_model.assert_called_once()
        mock_get_tools.assert_called_once()

        assert result.agent.model == self.mock_model
        assert isinstance(result, MUCGPTAgentExecutor)

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