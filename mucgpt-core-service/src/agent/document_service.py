import os

import httpx
from langchain_core.messages import SystemMessage

from core.logtools import getLogger

DOCUMENTS_TEMPLATE = """
# Documents
Following is the content of documents chosen by the user which should be used to answer the request.

{docs_content}
"""

logger = getLogger()

class DocumentService:
    DOC_SERVICE_URL = os.getenv("DOC_SERVICE_URL")

    def load_doc(self, doc_id: str) -> str:
        response = httpx.get(f"{self.DOC_SERVICE_URL}/api/docs/{doc_id}")
        return response.text

    def load_docs_reranked(self, ids: list[str], query: str) -> str:
        params = {
            "query": query,
            "file_ids": ids
        }
        response = httpx.get(f"{self.DOC_SERVICE_URL}/api/docs-reranked", params=params)
        return response.text

    def load_docs(self, ids: list[str]) -> str:
        docs = []
        for di in ids:
            docs.append(self.load_doc(di))
        return '\n\n'.join(docs)

    def inject_docs_in_messages(self, messages, ids: list[str], query: str):
        logger.info(f"Loading docs {ids} for query '{query}'")
        # load docs
        #docs_str = self.load_docs(ids=ids)
        docs_str = self.load_docs_reranked(ids=ids, query=query)
        # generate docs str
        doc_string = DOCUMENTS_TEMPLATE.format(
            docs_content=docs_str)
        # inject docs into messages
        if messages and isinstance(messages[0], SystemMessage):
            messages[0] = SystemMessage(
                content=f"{messages[0].content}\n\n{doc_string}"
            )
        else:
            messages.insert(0, SystemMessage(content=doc_string))
        return messages
