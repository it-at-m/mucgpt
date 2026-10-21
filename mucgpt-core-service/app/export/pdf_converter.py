from bs4 import BeautifulSoup
from weasyprint import HTML


def convert_pdf(html: str) -> bytes:
    soup = BeautifulSoup(html, "html.parser")
    for tag in soup.find_all(["script", "style"]):
        tag.decompose()
    return HTML(string=str(soup)).write_pdf()
