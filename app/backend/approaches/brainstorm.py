from typing import Any

import openai
from approaches.approach import Approach

class Brainstorm(Approach):
    # Chat roles
    SYSTEM = "system"
    USER = "user"

    """
    Simple brainstorm implementation. One shot generation of certain markdown files
    """
    system_sum_prompt = """You are a helpful assistant. """
    user_mindmap_prompt = """
      In a markdown file (MD) plan out a mind map on the topic {topic}. Follow the format in this example. Write it in a code snippet I can copy from directly. Include the exact format I used below.
    Example markdown format:

    # Central topic

    ## Main topic 1

    ### Subtopic 1

    – Subtopic 1

    – Subtopic 2

    – Subtopic 3

    ### Subtopic 2

    – Subtopic 1

    – Subtopic 2

    – Subtopic 3

    ## Main topic 2

    ### Subtopic 1

    – Subtopic 1

    – Subtopic 2

    – Subtopic 3"""

    system_translate_prompt = """Agiere als {language}-Übersetzer, du übersetzt kommentarlos jede Eingabe. Verstanden?"""
    user_translate_prompt = """
    Übersetze den folgenden Text in {language}.
    Text: {text}"""

    def __init__(self, chatgpt_deployment: str, chatgpt_model: str):
        self.chatgpt_deployment = chatgpt_deployment
        self.chatgpt_model = chatgpt_model

    def run(self, topic: str, overrides: dict[str, Any]) -> Any:
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
                "content": self.user_mindmap_prompt.format(topic=topic)
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
        #Falls Erklärungen um das Markdown außen rum existieren.
        if("```" in str(chat_translate_result)):
            splitted = str(chat_translate_result).split("````")
            if(len(splitted) == 3):
                chat_translate_result = splitted[1]
        #msg_to_display = '\n\n'.join([str(message) for message in messages])

        return {"data_points": [], "answer": chat_translate_result, "thoughts": f"Searched for:<br>{topic}<br><br>Conversations:<br>"} #+ msg_to_display.replace('\n', '<br>')}
    
