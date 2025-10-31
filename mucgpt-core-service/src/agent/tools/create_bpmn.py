import logging

from langchain_core.runnables.base import RunnableSerializable
from langgraph.types import StreamWriter

from agent.tools.bpmn_agent import BPMNAgent


def create_bpmn(
    process_text: str,
    model: RunnableSerializable,
    logger: logging.Logger,
    writer: StreamWriter = None,
) -> str:
    """Create a BPMN diagram from process description using a reflective agent with LangGraph."""

    try:
        # Create a BPMNAgent instance with the writer and run the BPMN creation workflow
        agent = BPMNAgent(model=model, logger=logger, writer=writer)
        return agent.run(process_text)

    except Exception as e:
        logger.error(f"Error in create_bpmn: {e}")
        if writer:
            from agent.tools.tool_chunk import ToolStreamChunk, ToolStreamState

            writer(
                ToolStreamChunk(
                    state=ToolStreamState.ENDED,
                    content=f"Fehler beim Erstellen des BPMN-Diagramms: {str(e)}",
                    tool_name="BPMN Creator",
                ).model_dump_json()
            )
        return f"Fehler beim Erstellen des BPMN-Diagramms: {str(e)}"
