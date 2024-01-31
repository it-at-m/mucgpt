from langchain.text_splitter import TokenTextSplitter
import PyPDF2
from langchain.docstore.document import Document



def textToDocs(text, chunk_size=2500, chunk_overlap=100):
    #split and convert to langchain docs
    text_splitter = TokenTextSplitter.from_tiktoken_encoder(
        chunk_size=chunk_size, chunk_overlap=chunk_overlap)
    texts = text_splitter.split_text(text)
    docs = [Document(page_content=t) for t in texts]
    return docs

def PDFtoDocs(pdf, chunk_size=2500, chunk_overlap=100):
     # creating a pdf reader object
    reader = PyPDF2.PdfReader(pdf)
    # read alll
    complete = ""
    for page in reader.pages:
        complete += page.extract_text()

    return textToDocs(text=complete, chunk_size=chunk_size, chunk_overlap=chunk_overlap)

# Same without langchain documents

def splitText(text, chunk_size=2500, chunk_overlap=100):
    #split
    text_splitter = TokenTextSplitter.from_tiktoken_encoder(
        chunk_size=chunk_size, chunk_overlap=chunk_overlap)
    texts = text_splitter.split_text(text)
    return texts

def splitPDF(pdf, chunk_size=2500, chunk_overlap=100):
     # creating a pdf reader object
    reader = PyPDF2.PdfReader(pdf)
    # read alll
    complete = ""
    for page in reader.pages:
        complete += page.extract_text()

    return splitText(text=complete, chunk_size=chunk_size, chunk_overlap=chunk_overlap)