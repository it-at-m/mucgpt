from typing import Any, AsyncGenerator, Sequence

import openai
from core.modelhelper import get_token_limit
from core.messagebuilder import MessageBuilder

class SimpleChatApproach():
    SYSTEM = "system"
    USER = "user"
    ASSISTANT = "assistant"


    def __init__(self, chatgpt_deployment: str, chatgpt_model: str):
        self.chatgpt_deployment = chatgpt_deployment
        self.chatgpt_model = chatgpt_model
        
        self.chatgpt_token_limit = get_token_limit(chatgpt_model)

    async def run_until_final_call(self, history: "Sequence[dict[str, str]]", overrides: "dict[str, Any]", should_stream: bool = False) -> Any:
        language = overrides.get("language")
        user_q =   history[-1]["user"]

        
        messages = self.get_messages_from_history(
            "",
            self.chatgpt_model,
            history,
            user_q,
            [],
            self.chatgpt_token_limit - len(user_q)
        )
        msg_to_display = '\n\n'.join([str(message) for message in messages])

        extra_info = {"data_points": [], "thoughts": f"Searched for:<br>{user_q}<br><br>Conversations:<br>" + msg_to_display.replace('\n', '<br>')}
        chat_coroutine = openai.ChatCompletion.acreate(
                deployment_id=self.chatgpt_deployment,
                model=self.chatgpt_model,
                messages=messages,
                temperature=overrides.get("temperature") or 0.7,
                max_tokens=1024,
                n=1,
                stream=should_stream)
        return (extra_info, chat_coroutine)
    
    async def run_without_streaming(self, history: 'list[dict[str, str]]', overrides: 'dict[str, Any]') -> 'dict[str, Any]':
        extra_info, chat_coroutine = await self.run_until_final_call(history, overrides, should_stream=False)
        chat_content = (await chat_coroutine).choices[0].message.content
        extra_info["answer"] = chat_content
        return extra_info

    async def run_with_streaming(self, history: 'list[dict[str, str]]', overrides: 'dict[str, Any]') -> AsyncGenerator[dict, None]:
        extra_info, chat_coroutine = await self.run_until_final_call(history, overrides, should_stream=True)
        yield extra_info
        async for event in await chat_coroutine:
            yield event

    

    def get_messages_from_history(self, system_prompt: str, model_id: str, history: 'list[dict[str, str]]', user_conv: 'str', few_shots = [], max_tokens: int = 4096) -> list:
        message_builder = MessageBuilder(system_prompt, model_id)

        # Add examples to show the chat what responses we want. It will try to mimic any responses and make sure they match the rules laid out in the system message.
        for shot in few_shots:
            message_builder.append_message(shot.get('role'), shot.get('content'))

        user_content = user_conv
        append_index = len(few_shots) + 1

        message_builder.append_message(self.USER, user_content, index=append_index)

        for h in reversed(history[:-1]):
            if bot_msg := h.get("bot"):
                message_builder.append_message(self.ASSISTANT, bot_msg, index=append_index)
            if user_msg := h.get("user"):
                message_builder.append_message(self.USER, user_msg, index=append_index)
            if message_builder.token_length > max_tokens:
                break

        messages = message_builder.messages
        return messages