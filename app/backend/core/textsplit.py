from langchain.text_splitter import TokenTextSplitter
import PyPDF2
from langchain.docstore.document import Document



def textToDocs(text, chunk_size=2500, chunk_overlap=100):
    #split
    text_splitter = TokenTextSplitter.from_tiktoken_encoder(
        chunk_size=chunk_size, chunk_overlap=chunk_overlap)
    texts = text_splitter.split_text(text)
    docs = [Document(page_content=t) for t in texts]
    return docs

def readPDF(pdf, chunk_size=2500, chunk_overlap=100):
     # creating a pdf reader object
    reader = PyPDF2.PdfReader(pdf)
    # read alll
    complete = ""
    for page in reader.pages:
        complete += page.extract_text()

    return textToDocs(text=complete, chunk_size=chunk_size, chunk_overlap=chunk_overlap)