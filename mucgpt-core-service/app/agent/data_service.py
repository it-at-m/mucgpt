import httpx
from langchain_core.messages import SystemMessage

from config.settings import get_settings
from core.logtools import getLogger

DATA_TEMPLATE = """
# Data
Following is the content of data chosen by the user which should be used to answer the request.
{data_content}
"""

logger = getLogger()


class DataService:
    def __init__(self):
        settings = get_settings()
        self._base_url = settings.MEMORY_SERVICE_URL
        logger.info(f"DataService configured with MEMORY_SERVICE_URL {self._base_url}")

    async def load_data(self, data_id: str) -> str:
        async with httpx.AsyncClient() as client:
            response = await client.get(f"{self._base_url}/api/data/{data_id}")
            response.raise_for_status()
            return response.text

    async def load_data_list(self, data_ids: list[str]) -> str:
        results = []
        for data_id in data_ids:
            results.append(await self.load_data(data_id))
        return "\n\n".join(results)

    async def inject_data_list_in_messages(self, messages, data_ids: list[str]):
        logger.info(f"Loading data {data_ids}")
        data_str = await self.load_data_list(data_ids=data_ids)
        data_string = DATA_TEMPLATE.format(data_content=data_str)
        if messages and isinstance(messages[0], SystemMessage):
            messages[0] = SystemMessage(
                content=f"{messages[0].content}\n\n{data_string}"
            )
        else:
            messages.insert(0, SystemMessage(content=data_string))
        return messages
