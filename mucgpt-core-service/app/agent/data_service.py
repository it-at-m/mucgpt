import os

import httpx
from langchain_core.messages import SystemMessage

from core.logtools import getLogger

DATA_TEMPLATE = """
# Data
Following is the content of data chosen by the user which should be used to answer the request.
{data_content}
"""

logger = getLogger()


class DataService:
    DATA_SERVICE_URL = os.getenv("DATA_SERVICE_URL")

    def load_data(self, data_id: str) -> str:
        response = httpx.get(f"{self.DATA_SERVICE_URL}/api/data/{data_id}")
        return response.text

    def load_data_reranked(self, data_ids: list[str], query: str) -> str:
        params = {"query": query, "file_ids": data_ids}
        response = httpx.get(
            f"{self.DATA_SERVICE_URL}/api/data-reranked", params=params
        )
        return response.text

    def load_data_list(self, data_ids: list[str]) -> str:
        data_list = []
        for data_id in data_ids:
            data_list.append(self.load_data(data_id))
        return "\n\n".join(data_list)

    def inject_data_list_in_messages(self, messages, data_ids: list[str], query: str):
        logger.info(f"Loading data {data_ids} for query '{query}'")
        # load data
        # docs_str = self.load_docs(ids=ids)
        data_str = self.load_data_reranked(data_ids=data_ids, query=query)
        # generate data str
        data_string = DATA_TEMPLATE.format(data_content=data_str)
        # inject data into messages
        if messages and isinstance(messages[0], SystemMessage):
            messages[0] = SystemMessage(
                content=f"{messages[0].content}\n\n{data_string}"
            )
        else:
            messages.insert(0, SystemMessage(content=data_string))
        return messages
