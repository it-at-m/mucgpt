from io import BytesIO
from urllib.parse import urlparse

from bs4 import BeautifulSoup
from weasyprint import HTML, URLFetcher
from weasyprint.urls import URLFetcherResponse

from export.image_fetcher import fetch_allowed_image


class ExportURLFetcher(URLFetcher):
    """data: URIs via the base fetcher plus images hosted on the deployment's
    allowed_link_domains, fetched server-side (the browser export cannot read
    those responses because of CORS). Everything else degrades silently; any
    base scheme other than data: stays forbidden."""

    def __init__(self):
        super().__init__(allowed_protocols={"data"})

    def fetch(self, url, headers=None):
        parsed = urlparse(url)
        if parsed.scheme in {"http", "https"}:
            fetched = fetch_allowed_image(url)
            if fetched is None:
                raise ValueError(f"Image URL is not allowlisted or unfetchable: {url}")
            data, content_type = fetched
            return URLFetcherResponse(
                url, BytesIO(data), {"Content-Type": content_type}, 200
            )
        return super().fetch(url, headers)


_url_fetcher = ExportURLFetcher()


def convert_pdf(html: str) -> bytes:
    soup = BeautifulSoup(html, "html.parser")
    for tag in soup.find_all(["script", "style"]):
        tag.decompose()
    # The editor serializes image nodes as spans with data attributes (no
    # fetchable src; issue #228): materialize img tags so the fetcher sees them.
    for span in soup.find_all("span", attrs={"data-canvas-image-src": True}):
        img = soup.new_tag("img")
        src = str(span.get("data-canvas-image-src", ""))
        alt = str(span.get("data-canvas-image-alt", ""))
        img.attrs = {"src": src, "alt": alt}
        span.replace_with(img)
    return HTML(string=str(soup), url_fetcher=_url_fetcher).write_pdf()
