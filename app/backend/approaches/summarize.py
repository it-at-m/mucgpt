from typing import Any, Sequence

import openai
from approaches.approach import Approach

class Summarize(Approach):
    # Chat roles
    SYSTEM = "system"
    USER = "user"

    """
    Simple summarize implementation. One shot summarization of the given text.
    """
    system_message_prompt = """You are a helpful assistant for text summarization. Answer in {language}. """
    user_message_prompt = """Summarize this in two sentences for a {person_type}: 
    
    {text}"""


    def __init__(self, chatgpt_deployment: str, chatgpt_model: str):
        self.chatgpt_deployment = chatgpt_deployment
        self.chatgpt_model = chatgpt_model

    def run(self, text: str, overrides: dict[str, Any]) -> Any:
        person_type = overrides.get("person_type")
        language = overrides.get("language")

        # STEP 3: Generate a contextual and content specific answer using the search results and chat history
        chat_completion = openai.ChatCompletion.create(
            deployment_id=self.chatgpt_deployment,
            model=self.chatgpt_model,
            messages= [
                {
                "role": self.SYSTEM,
                "content": self.system_message_prompt.format(language=language),
                },
                {
                "role": self.USER,
                "content": self.user_message_prompt.format(person_type=person_type, text=text)
                },
            ], 
            temperature=overrides.get("temperature") or 0.7, 
            max_tokens=1024, 
            n=1)
        
        chat_content = chat_completion.choices[0].message.content

        #msg_to_display = '\n\n'.join([str(message) for message in messages])

        return {"data_points": [], "answer": chat_content, "thoughts": f"Searched for:<br>{text}<br><br>Conversations:<br>"} #+ msg_to_display.replace('\n', '<br>')}
    
