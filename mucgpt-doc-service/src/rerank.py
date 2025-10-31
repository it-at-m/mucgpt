from os import getenv

from cohere import AsyncClientV2
from cohere.v2.types import V2RerankResponse
from langchain_core.documents import Document
from langchain_text_splitters import (
    MarkdownHeaderTextSplitter,
    RecursiveCharacterTextSplitter,
)

CHUNK_SIZE = 4096

def get_chunks(text, chunk_size = CHUNK_SIZE, chunk_overlap = 100) -> list[Document]:
    text_splitter = RecursiveCharacterTextSplitter(
        chunk_size=chunk_size,
        chunk_overlap=chunk_overlap,
        length_function=len,
        is_separator_regex=False,
    )
    documents = text_splitter.create_documents([text])
    return documents

class Reranker:
    def __init__(self) -> None:
        API_KEY: str | None = getenv("OPENAI_API_KEY")
        BASE_URL: str | None = getenv("OPENAI_API_BASE")

        if API_KEY is None or BASE_URL is None:
            raise ValueError("OPENAI_API_KEY and OPENAI_API_BASE environment variables must be set for rerank model.")

        self.client: AsyncClientV2 = AsyncClientV2(api_key=API_KEY, base_url=BASE_URL)

    def _none_to_num(self, x: int | None) -> int:
        return x if x is not None else 0

    async def arerank_documents(self, query: str, doc: str , budget = 4, threshold = 0.8, **kwargs) -> list[Document]:
        """
        Asynchronously rerank a list of documents using the Cohere rerank model.
        Also applies an extra boost based on site visit stats.
        budet = num of chunks 
        threshold for relevance score
        """

        if not doc:
            print("error")
            return []
        
        chunks = get_chunks(doc)

        response: V2RerankResponse = await self.client.rerank(
            model=getenv("COHERE_RERANK_MODEL", "cohere-rerank-v3.5"),
            query=query,
            documents=[chunk.page_content for chunk in chunks],
        )

        # extract the indices from the reranker results
        idxs = [res.index for res in response.results]

        # relevance scores from the reranker and site visit stats from doc metadata
        rel_scores = [res.relevance_score for res in response.results]
        reranked_chunks = []

        for i, score in zip(idxs, rel_scores):
            #TODO threshhold score
            reranked_chunks.append(chunks[i])

        top_chunks = reranked_chunks[:4]

        return top_chunks
    

    
#TODO Chunkin based on token not chars 
    
