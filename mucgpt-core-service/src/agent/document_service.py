import os
import httpx

from langchain_core.messages import SystemMessage

DOCUMENTS_TEMPLATE = """
# Documents
Following is the content of documents chosen by the user which should be used to answer the request.

{docs_content}
"""

class DocumentService:
    DOC_SERVICE_URL = os.getenv("DOC_SERVICE_URL")

    def load_docs(self, ids: list[str]) -> list[str]:
        docs = []
        for di in ids:
            response = httpx.get(f"{self.DOC_SERVICE_URL}/docs/{di}")
            docs.append(response.text)
        return docs

    def inject_docs_in_messages(self, messages, ids: list[str]):
        # load docs
        docs = self.load_docs(ids=ids)
        # generate docs str
        doc_string = DOCUMENTS_TEMPLATE.format(
            docs_content='\n\n'.join(docs)
        )
        # inject docs into messages
        if messages and isinstance(messages[0], SystemMessage):
            messages[0] = SystemMessage(
                content=f"{messages[0].content}\n\n{doc_string}"
            )
        else:
            messages.insert(0, SystemMessage(content=doc_string))
        return messages
