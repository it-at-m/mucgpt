# Typing
import re
from typing import List, Optional

# Third-party
from langchain_core.messages import BaseMessage, HumanMessage, SystemMessage
from langchain_core.runnables.base import RunnableSerializable
from langchain_core.tools import tool
from langchain_core.tools.base import BaseTool

# Local application imports
from core.logtools import getLogger

logger = getLogger(name="mucgpt-core-tools")


class ToolCollection:
    """Collection of chat tools for brainstorming and simplification."""

    def __init__(self, model: RunnableSerializable):
        self.model = model
        # Create tools as bound methods
        self._brainstorm_tool = self._create_brainstorm_tool()
        self._simplify_tool = self._create_simplify_tool()
        self._weather_tool = self._create_weather_tool()

    def _create_weather_tool(self):
        @tool(description="Get the current weather for a given location.")
        def Wettervorhersage(location: str):
            """Call to get the current weather."""
            if location.lower() in ["sf", "san francisco"]:
                return "It's 60 degrees and foggy."
            else:
                return "It's 90 degrees and sunny."

        return Wettervorhersage

    def _create_brainstorm_tool(self):
        @tool(description="Generate a mind map for a given topic in markdown format.")
        def Brainstorming(topic: str, context: Optional[str] = None) -> str:
            """Generate a comprehensive mind map for a given topic in structured markdown format."""
            logger.info("Brainstorm tool called for topic: %s", topic)

            mindmap_prompt = f"""
            Plan out a mind map in a markdown file on the topic {topic} using the provided format.

            Follow the following rules:
            - Be very creative and very detailed
            - Format the texts in markdown, where it fits.
              - Display the text for the most important topic in bold.
              - Use always more sublists, if more than one subtopic is available.
              - Do just include the topics without structuring information (like topic 1, topic 2, etc.)

            Use the following structure to ensure clarity and organization:

            # Central topic

            ## Main topic 1

            ### Subtopic 1

            - Subsubtopic 1
             - Subsubsubtopic 1
             - Subsubsubtopic 2
              - Subsubsubsubtopic 1
            - Subsubtopic 2
            - Subsubtopic 3

            ### Subtopic 2

            - Subsubtopic 1
            - Subsubtopic 2
            - Subsubtopic 3

            ## Main topic 2

            ### Subtopic 1

            - Subsubtopic 1
            - Subsubtopic 2
            - Subsubtopic 3

            # Output Format

            The output should be formatted as a markdown code snippet for easy copying. Include all elements in the structure specified above, maintaining organized headings and bullet points.
            """

            if context:
                mindmap_prompt += f"\n\nAdditional context: {context}"

            system_msg = SystemMessage(
                content="You are a creative brainstorming assistant that creates detailed mind maps in markdown format."
            )
            user_msg = HumanMessage(content=mindmap_prompt)
            msgs: List[BaseMessage] = [system_msg, user_msg]

            try:
                llm = self.model.with_config(
                    {
                        "llm_temperature": 0.8,
                        "llm_max_tokens": 2000,
                        "llm_streaming": False,
                    }
                )
                response = llm.invoke(msgs)
                return self._cleanup_mindmap(response.content)
            except Exception as e:
                logger.error("Brainstorm tool error: %s", str(e))
                return f"Error brainstorming for '{topic}'"

        return Brainstorming

    def _create_simplify_tool(self):
        @tool(description="Simplify complex text to A2 level using Leichte Sprache.")
        def Vereinfachen(text: str) -> str:
            """Simplify complex text using the same approach as the simply.py service."""

            try:
                # Use default llm_name based on target_audience or use a reasonable default
                llm_name = "openai"  # Default to OpenAI approach
                temperature = (
                    0.3  # Lower temperature for more consistent simplification
                )

                # Build prompt like in simply.py
                prompt = self._build_prompt_plain(llm_name=llm_name, message=text)
                system_message = self._get_system_message()

                # Create messages
                msgs = []
                if system_message and system_message.strip():
                    msgs.append(SystemMessage(content=system_message))
                msgs.append(HumanMessage(content=prompt))

                # Configure LLM
                llm = self.model.with_config(
                    {
                        "llm_temperature": temperature,
                        "llm_streaming": False,
                        "llm_max_tokens": 1500,
                    }
                )

                # Get response
                response = llm.invoke(msgs)

                # Extract text like in simply.py
                return self._extract_text(response.content)

            except Exception as e:
                logger.error("Simplify tool error: %s", str(e))
                return f"Error simplifying text: {str(e)}"

        return Vereinfachen

    def _cleanup_mindmap(self, mindmap_result: str) -> str:
        """Remove leading explanation and extract markdown content.

        Args:
            mindmap_result (str): The result of the brainstorming, sometimes has leading explanation before the markdown part

        Returns:
            str: The result of the brainstorming without leading explanations
        """
        if "```" in mindmap_result:
            splitted = str(mindmap_result).split("```")
            if len(splitted) == 3:
                mindmap_result = splitted[1]
                # Remove potential language identifier (e.g., 'markdown')
                lines = mindmap_result.split("\n")
                if lines and lines[0].strip().lower() in ["markdown", "md"]:
                    mindmap_result = "\n".join(lines[1:])
        return mindmap_result.strip()

    def _get_system_message(self) -> str:
        """Get system message from file like simply.py does."""
        try:
            with open("simply/prompts/system_message_es.md", encoding="utf-8") as f:
                return f.read()
        except FileNotFoundError:
            logger.warning("system_message_es.md not found, using fallback")
            return """Du bist ein hilfreicher Assistent, der Texte in Leichte Sprache, Sprachniveau A2, umschreibt. Sei immer wahrheitsgemäß und objektiv. Schreibe nur das, was du sicher aus dem Text des Benutzers weisst. Arbeite die Texte immer vollständig durch und kürze nicht. Mache keine Annahmen. Schreibe einfach und klar und immer in deutscher Sprache. Gib dein Ergebnis innerhalb von <einfachesprache> Tags aus. Füge dabei nach JEDEM Satz zwei Leerzeichen ein, um einen Zeilenumbruch in Markdown zu erzeugen. Beachte ALLE Regeln der Leichten Sprache."""

    def _build_prompt_plain(self, llm_name: str, message: str) -> str:
        """Build prompt like simply.py does."""
        logger.info("Building prompt for plain output")

        # Get rules
        try:
            with open("simply/prompts/rules_es.md", encoding="utf-8") as f:
                rules = f.read()
        except FileNotFoundError:
            logger.warning("rules_es.md not found, using fallback")
            rules = self._get_fallback_rules()

        # Get prompt template based on llm
        try:
            if "mistral" in llm_name.lower():
                logger.info("Using Mistral plain prompt")
                with open("simply/prompts/prompt_mistral_es.md", encoding="utf-8") as f:
                    prompt = f.read()
            else:
                logger.info("Using OpenAI plain prompt")
                with open("simply/prompts/prompt_openai_es.md", encoding="utf-8") as f:
                    prompt = f.read()
        except FileNotFoundError:
            logger.warning("Prompt file not found, using fallback")
            prompt = self._get_fallback_prompt()

        return prompt.format(message=message, rules=rules)

    def _extract_text(self, response: str) -> str:
        """Extract text between tags from response, exactly like simply.py."""
        logger.info("Extracting text")
        result = re.findall(
            r"<einfachesprache>(.*?)</einfachesprache>", response, re.DOTALL
        )
        result = "\n".join(result)
        return result.strip()

    def _get_fallback_rules(self) -> str:
        """Fallback rules if file not found."""
        return """# Wortebene
## Wortschatz
- Wörter sollten kurz sein.
- Wörter sollten anschaulich sein.
- Wörter sollten häufig verwendet werden.
- Wörter sollten alltagsnah sein.

## Synonyme
- Vermeiden Sie verschiedene Bezeichnungen für dasselbe innerhalb desselben Textes.
- Bezeichnen Sie Gleiches immer gleich im Text."""

    def _get_fallback_prompt(self) -> str:
        """Fallback prompt if file not found."""
        return """Bitte schreibe den folgenden schwer verständlichen Text vollständig in Leichte Sprache, Sprachniveau A2, um.

Beachte dabei folgende Regeln für Leichte Sprache (A2):

{rules}

Schreibe den vereinfachten Text innerhalb von <einfachesprache> Tags. Füge dabei nach jedem Satz zwei Leerzeichen ein, um einen Zeilenumbruch in Markdown zu erzeugen.

Hier ist der schwer verständliche Text:

--------------------------------------------------------------------------------

{message}"""

    @property
    def simplify(self):
        return self._simplify_tool

    @property
    def brainstorm(self):
        return self._brainstorm_tool

    def get_tools(self):
        """Return a list of all tool callables."""
        return [self._brainstorm_tool, self._simplify_tool, self._weather_tool]

    def get_all(self, enabled_tools: Optional[list[str]] = None) -> list[BaseTool]:
        """Return a list of tools, optionally filtered by enabled_tools."""
        all_tools = [self._brainstorm_tool, self._simplify_tool, self._weather_tool]
        if enabled_tools:
            return self.filter_tools_by_names(enabled_tools)
        return all_tools

    def filter_tools_by_names(self, tool_names: list[str]) -> list[BaseTool]:
        """Return only tools whose name is in tool_names."""
        return [tool for tool in self.get_all() if tool.name in tool_names]

    def add_instructions(
        self, messages: List[BaseMessage], enabled_tools: list
    ) -> List[BaseMessage]:
        """Inject a system message describing available tools."""
        if not enabled_tools or len(enabled_tools) == 0:
            return messages

        tool_descriptions = []
        # Support both tool names (str) and tool objects (for tests)
        for t in enabled_tools:
            if hasattr(t, "name") and hasattr(t, "description"):
                tool_descriptions.append(f"- {t.name}: {t.description}")
            else:
                # Look up real tool by name
                tool = next((tool for tool in self.get_all() if tool.name == t), None)
                if tool:
                    tool_descriptions.append(f"- {tool.name}: {tool.description}")

        tool_instructions = (
            "You have access to the following tools:\n"
            + "\n".join(tool_descriptions)
            + "\nInvoke them when helpful to the user's request."
        )

        if messages and isinstance(messages[0], SystemMessage):
            updated = f"{messages[0].content}\n\n{tool_instructions}"
            messages[0] = SystemMessage(content=updated)
        else:
            messages.insert(0, SystemMessage(content=tool_instructions))
        return messages

    @staticmethod
    def list_tool_metadata():
        """Dynamically return metadata for all available tools (name, description) without requiring a model."""

        # Create dummy ToolCollection with a mock model (None or a dummy callable)
        class DummyModel:
            def with_config(self, *args, **kwargs):
                return self

            def invoke(self, *args, **kwargs):
                return type("DummyResponse", (), {"content": ""})()

        dummy = ToolCollection(DummyModel())
        tools = [dummy._brainstorm_tool, dummy._simplify_tool, dummy._weather_tool]
        return [{"name": t.name, "description": t.description} for t in tools]
