from typing import List

from langchain.docstore.document import Document
from langchain.text_splitter import TokenTextSplitter
from pypdf import PdfReader


def textToDocs(text: str, chunk_size=2500, chunk_overlap=100) -> List[Document]:
    """split and convert to langchain docs

    Args:
        text (str): given text
        chunk_size (int, optional): Splits the text into chunks of this size. Defaults to 2500.
        chunk_overlap (int, optional): how much overlap between the chunks. Defaults to 100.

    Returns:
        List[Document]: List of documents, containing the splits
    """
    text_splitter = TokenTextSplitter.from_tiktoken_encoder(
        chunk_size=chunk_size, chunk_overlap=chunk_overlap)
    texts = text_splitter.split_text(text)
    docs = [Document(page_content=t) for t in texts]
    return docs

def PDFtoDocs(pdf, chunk_size=2500, chunk_overlap=100) -> List[Document]:
    """read pdf and convert o chunks of langchain docs

    Args:
        pdf (_type_): a pdf
        chunk_size (int, optional): Splits the text into chunks of this size. Defaults to 2500.
        chunk_overlap (int, optional): how much overlap between the chunks. Defaults to 100.
    Returns:
        List[Document]: List of documents, containing the splits
    """
     # creating a pdf reader object
    reader = PdfReader(pdf)
    # read alll
    complete = ""
    for page in reader.pages:
        complete += page.extract_text()

    return textToDocs(text=complete, chunk_size=chunk_size, chunk_overlap=chunk_overlap)

# Same without langchain documents

def splitText(text: str, chunk_size=2500, chunk_overlap=100) -> List[str]:
    """split and convert to text chunks

    Args:
        text (str): given text
        chunk_size (int, optional): Splits the text into chunks of this size. Defaults to 2500.
        chunk_overlap (int, optional): how much overlap between the chunks. Defaults to 100.

    Returns:
        List[Document]: List of documents, containing the splits
    """
    #split
    text_splitter = TokenTextSplitter.from_tiktoken_encoder(
        chunk_size=chunk_size, chunk_overlap=chunk_overlap)
    texts = text_splitter.split_text(text)
    return texts

def splitPDF(pdf, chunk_size=2500, chunk_overlap=100) -> List[str]:
    """read pdf and convert o chunks of text chunks

    Args:
        pdf (_type_): a pdf
        chunk_size (int, optional): Splits the text into chunks of this size. Defaults to 2500.
        chunk_overlap (int, optional): how much overlap between the chunks. Defaults to 100.
    Returns:
        List[str]: list of chunks
    """
     # creating a pdf reader object
    reader = PdfReader(pdf)
    # read alll
    complete = ""
    for page in reader.pages:
        complete += page.extract_text()

    return splitText(text=complete, chunk_size=chunk_size, chunk_overlap=chunk_overlap)