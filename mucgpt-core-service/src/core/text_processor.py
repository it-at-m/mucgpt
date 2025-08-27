from langchain.docstore.document import Document
from langchain.text_splitter import TokenTextSplitter
from pypdf import PdfReader


class TextProcessor:
    """
    Text processing utilities for chunking and document conversion.
    """

    @staticmethod
    def split_text(
        text: str, chunk_size: int = 2500, chunk_overlap: int = 100
    ) -> list[str]:
        text_splitter = TokenTextSplitter.from_tiktoken_encoder(
            chunk_size=chunk_size, chunk_overlap=chunk_overlap
        )
        return text_splitter.split_text(text)

    @staticmethod
    def text_to_documents(
        text: str, chunk_size: int = 2500, chunk_overlap: int = 100
    ) -> list[Document]:
        chunks = TextProcessor.split_text(text, chunk_size, chunk_overlap)
        return [Document(page_content=chunk) for chunk in chunks]

    @staticmethod
    def pdf_to_text(
        pdf_file,
    ) -> str:
        try:
            reader = PdfReader(pdf_file)
            return "".join(page.extract_text() for page in reader.pages)
        except Exception as e:
            raise ValueError(f"Failed to extract text from PDF: {str(e)}")

    @staticmethod
    def pdf_to_documents(
        pdf_file, chunk_size: int = 2500, chunk_overlap: int = 100
    ) -> list[Document]:
        text = TextProcessor.pdf_to_text(pdf_file)
        return TextProcessor.text_to_documents(text, chunk_size, chunk_overlap)
