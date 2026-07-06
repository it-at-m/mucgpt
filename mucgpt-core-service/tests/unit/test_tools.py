from types import SimpleNamespace

import pytest

from agent.state_models.atlassian_state import AtlassianAgentState
from agent.state_models.default_state import DefaultAgentState
from agent.tools.tools import select_agent_state_schema


def _tool(name: str, metadata):
    return SimpleNamespace(name=name, metadata=metadata)


@pytest.mark.unit
def test_select_agent_state_schema_uses_dict_metadata_mcp_group():
    tools = [
        _tool(
            "getJiraIssue",
            {"mcp_group": "atlassian", "mcp_source": "mcp-atlassian"},
        )
    ]

    assert select_agent_state_schema(tools) is AtlassianAgentState


@pytest.mark.unit
def test_select_agent_state_schema_uses_object_metadata_mcp_group():
    tools = [
        _tool(
            "getJiraIssue",
            SimpleNamespace(mcp_group="atlassian", mcp_source="mcp-atlassian"),
        )
    ]

    assert select_agent_state_schema(tools) is AtlassianAgentState


@pytest.mark.unit
def test_select_agent_state_schema_defaults_for_multiple_groups():
    tools = [
        _tool("getJiraIssue", {"mcp_group": "atlassian"}),
        _tool("otherTool", {"mcp_group": "other"}),
    ]

    assert select_agent_state_schema(tools) is DefaultAgentState


@pytest.mark.unit
def test_select_agent_state_schema_defaults_for_missing_and_named_group():
    tools = [
        _tool("getJiraIssue", {"mcp_group": "atlassian"}),
        _tool("ungroupedTool", {"mcp_group": None}),
    ]

    assert select_agent_state_schema(tools) is DefaultAgentState
