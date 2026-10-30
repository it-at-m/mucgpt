from bs4 import BeautifulSoup
from weasyprint import HTML, URLFetcher

_url_fetcher = URLFetcher(allowed_protocols={"data"})


def convert_pdf(html: str) -> bytes:
    soup = BeautifulSoup(html, "html.parser")
    for tag in soup.find_all(["script", "style"]):
        tag.decompose()
    return HTML(string=str(soup), url_fetcher=_url_fetcher).write_pdf()
