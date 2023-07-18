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
    system_sum_prompt = """You are a helpful assistant for text summarization. """
    user_sum_prompt = """
    Summarize the following text for a {person_type}.
    The summary can be up to 3 sentences in length, expressing the key points and concepts written in the original text without adding your interpretations. 

    Text: {text}"""

    system_translate_prompt = """Agiere als {language}-Übersetzer, du übersetzt kommentarlos jede Eingabe. Verstanden?"""
    user_translate_prompt = """
    Übersetze den folgenden Text in {language}.
    Text: {text}"""

    def __init__(self, chatgpt_deployment: str, chatgpt_model: str):
        self.chatgpt_deployment = chatgpt_deployment
        self.chatgpt_model = chatgpt_model

    def run(self, text: str, overrides: dict[str, Any]) -> Any:
        person_type = overrides.get("person_type")
        language = overrides.get("language")

        # STEP 3: Generate a contextual and content specific answer using the search results and chat history
        chat_completion_sum = openai.ChatCompletion.create(
            deployment_id=self.chatgpt_deployment,
            model=self.chatgpt_model,
            messages= [
                {
                "role": self.SYSTEM,
                "content": self.system_sum_prompt.format()
                },
                {
                "role": self.USER,
                "content": self.user_sum_prompt.format(person_type=person_type, text=text)
                },
            ], 
            temperature=overrides.get("temperature") or 0.7, 
            max_tokens=1024, 
            n=1)
        
        chat_sum_result = chat_completion_sum.choices[0].message.content

        chat_completion_translate = openai.ChatCompletion.create(
            deployment_id=self.chatgpt_deployment,
            model=self.chatgpt_model,
            messages= [
                {
                "role": self.SYSTEM,
                "content": self.system_translate_prompt.format(language=language)
                },
                {
                "role": self.USER,
                "content": self.user_translate_prompt.format(language=str(language).lower(), text = chat_sum_result)
                },
            ], 
            temperature=overrides.get("temperature") or 0.7, 
            max_tokens=1024, 
            n=1)


        chat_translate_result = chat_completion_translate.choices[0].message.content
        #msg_to_display = '\n\n'.join([str(message) for message in messages])

        return {"data_points": [], "answer": chat_translate_result, "thoughts": f"Searched for:<br>{text}<br><br>Conversations:<br>"} #+ msg_to_display.replace('\n', '<br>')}
    
