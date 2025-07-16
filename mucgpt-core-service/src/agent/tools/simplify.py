import logging

from langchain.output_parsers.regex import RegexParser
from langchain_core.messages import HumanMessage, SystemMessage
from langchain_core.runnables.base import RunnableSerializable

from agent.tools.prompts_fallback import (
    SIMPLIFY_RULES_FALLBACK,
    SIMPLIFY_SYSTEM_MESSAGE_FALLBACK,
    get_fallback_prompt,
)


def get_system_message() -> str:
    try:
        with open("simply/prompts/system_message_es.md", encoding="utf-8") as f:
            return f.read()
    except FileNotFoundError:
        return SIMPLIFY_SYSTEM_MESSAGE_FALLBACK


def build_prompt_plain(llm_name: str, message: str) -> str:
    try:
        with open("simply/prompts/rules_es.md", encoding="utf-8") as f:
            rules = f.read()
    except FileNotFoundError:
        rules = SIMPLIFY_RULES_FALLBACK
    try:
        if "mistral" in llm_name.lower():
            with open("simply/prompts/prompt_mistral_es.md", encoding="utf-8") as f:
                prompt = f.read()
            return prompt.format(message=message, rules=rules)
        else:
            with open("simply/prompts/prompt_openai_es.md", encoding="utf-8") as f:
                prompt = f.read()
            return prompt.format(message=message, rules=rules)
    except FileNotFoundError:
        prompt_template = get_fallback_prompt()
        return prompt_template.format(rules=rules, message=message)


def extract_text(response: str) -> str:
    parser = RegexParser(
        regex=r"<einfachesprache>(.*?)</einfachesprache>",
        output_keys=["text"],
        default_output_key="text",
        flags=2,  # re.DOTALL
    )
    result = parser.parse(response)
    return result.get("text", "").strip()


def simplify(text: str, model: RunnableSerializable, logger: logging.Logger) -> str:
    """Simplify complex text using the same approach as the simply.py service."""
    try:
        llm_name = "openai"
        temperature = 0.3
        prompt = build_prompt_plain(llm_name=llm_name, message=text)
        system_message = get_system_message()
        msgs = []
        if system_message and system_message.strip():
            msgs.append(SystemMessage(content=system_message))
        msgs.append(HumanMessage(content=prompt))
        llm = model.with_config(
            {
                "llm_temperature": temperature,
                "llm_streaming": False,
                "llm_max_tokens": 1500,
            }
        )
        response = llm.invoke(msgs)
        simplified = extract_text(response.content)
        return simplified
    except Exception as e:
        logger.error("Simplify tool error: %s", str(e))
        return f"Error simplifying text: {str(e)}"
