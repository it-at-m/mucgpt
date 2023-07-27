from typing import Any, Sequence

import openai
import tiktoken
from approaches.approach import Approach
from text import nonewlines

class SimpleChatApproach(Approach):
    # Chat roles
    SYSTEM = "system"
    USER = "user"
    ASSISTANT = "assistant"

    """
    Simple assistant approach. Only uses trained information and message history.
    """
    system_message_chat_conversation = """
{follow_up_questions_prompt}
{injected_prompt}
"""
    follow_up_questions_prompt_content = """Generate three very brief follow-up questions that the user would likely ask next based on its previous message history. 
    Use double angle brackets to reference the questions, e.g. <<Are there exclusions for prescriptions?>>.
    Try not to repeat questions that have already been asked.
    Only generate questions and do not generate any text before or after the questions, such as 'Next Questions'"""


    def __init__(self, chatgpt_deployment: str, chatgpt_model: str):
        self.chatgpt_deployment = chatgpt_deployment
        self.chatgpt_model = chatgpt_model

    def run(self, history: Sequence[dict[str, str]], overrides: dict[str, Any]) -> Any:
        prompt_override  =  history[-1]["user"]
        language = overrides.get("language")
        follow_up_questions_prompt = self.follow_up_questions_prompt_content if overrides.get("suggest_followup_questions") else ""
        
        messages = self.get_messages_from_history(prompt_override=prompt_override, follow_up_questions_prompt=follow_up_questions_prompt,history=history, language=language)

        # STEP 3: Generate a contextual and content specific answer using the search results and chat history
        chat_completion = openai.ChatCompletion.create(
            deployment_id=self.chatgpt_deployment,
            model=self.chatgpt_model,
            messages=messages, 
            temperature=overrides.get("temperature") or 0.7, 
            max_tokens=1024, 
            n=1)
        
        chat_content = chat_completion.choices[0].message.content

        msg_to_display = '\n\n'.join([str(message) for message in messages])

        return {"data_points": [], "answer": chat_content, "thoughts": f"Searched for:<br>{prompt_override}<br><br>Conversations:<br>" + msg_to_display.replace('\n', '<br>')}
    
    def get_chat_history_as_text(self, history: Sequence[dict[str, str]], include_last_turn: bool=True, approx_max_tokens: int=1000) -> str:
        history_text = ""
        for h in reversed(history if include_last_turn else history[:-1]):
            history_text = """<|im_start|>user""" + "\n" + h["user"] + "\n" + """<|im_end|>""" + "\n" + """<|im_start|>assistant""" + "\n" + (h.get("bot", "") + """<|im_end|>""" if h.get("bot") else "") + "\n" + history_text
            if len(history_text) > approx_max_tokens*4:
                break    
        return history_text
    
    def get_messages_from_history(self, prompt_override, follow_up_questions_prompt, history: Sequence[dict[str, str]], language: str, approx_max_tokens: int = 1000) -> []:
        '''
        Generate messages needed for chat Completion api
        '''
        messages = []
        token_count = 0
        if prompt_override is None:
            system_message = self.system_message_chat_conversation.format(injected_prompt="", follow_up_questions_prompt=follow_up_questions_prompt)
        elif prompt_override.startswith(">>>"):
            system_message = self.system_message_chat_conversation.format(injected_prompt=prompt_override[3:] + "\n", follow_up_questions_prompt=follow_up_questions_prompt)
        else:
            system_message = prompt_override.format(follow_up_questions_prompt=follow_up_questions_prompt)

        messages.append({"role":self.SYSTEM, "content": system_message})
        token_count += self.num_tokens_from_messages(messages[-1], self.chatgpt_model)
        
        # latest conversation
        user_content = history[-1]["user"]
        messages.append({"role": self.USER, "content": user_content})
        token_count += token_count + self.num_tokens_from_messages(messages[-1], self.chatgpt_model)

        '''
        Enqueue in reverse order
        if limit exceeds truncate old messages 
        leaving system message behind
        Keep track of token count for each conversation
        If token count exceeds limit, break
        '''
        for h in reversed(history[:-1]):
            if h.get("bot"):
                messages.insert(1, {"role": self.ASSISTANT, "content" : h.get("bot")})
                token_count += self.num_tokens_from_messages(messages[1], self.chatgpt_model)
            messages.insert(1, {"role": self.USER, "content" : h.get("user")})
            token_count += self.num_tokens_from_messages(messages[1], self.chatgpt_model)
            if token_count > approx_max_tokens*4:
                break
        return messages
    
    def num_tokens_from_messages(self, message: dict[str,str], model: str) -> int:
        """
        Calculate the number of tokens required to encode a message.
        Args:
            message (dict): The message to encode, represented as a dictionary.
            model (str): The name of the model to use for encoding.
        Returns:
            int: The total number of tokens required to encode the message.
        Example:
            message = {'role': 'user', 'content': 'Hello, how are you?'}
            model = 'gpt-3.5-turbo'
            num_tokens_from_messages(message, model)
            output: 11
        """
        encoding = tiktoken.encoding_for_model(self.get_oai_chatmodel_tiktok(model))
        num_tokens = 0
        num_tokens += 2  # For "role" and "content" keys
        for key, value in message.items():
            num_tokens += len(encoding.encode(value))
        return num_tokens

    def get_oai_chatmodel_tiktok(self, aoaimodel: str):
        if aoaimodel == "" or aoaimodel is None:
            raise Exception("Expected AOAI chatGPT model name")
        
        return "gpt-3.5-turbo" if aoaimodel == "gpt-35-turbo" else aoaimodel
