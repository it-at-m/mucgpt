from io import BytesIO
from urllib.parse import urlparse

from weasyprint import HTML, URLFetcher
from weasyprint.urls import URLFetcherResponse

from export.image_fetcher import fetch_allowed_image


class ExportURLFetcher(URLFetcher):
    """data:image/* URIs via the base fetcher plus images hosted on the
    deployment's allowed_link_domains, fetched server-side (the browser export
    cannot read those responses because of CORS). Everything else degrades
    silently; any base scheme other than data:image/* stays forbidden."""

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
        if parsed.scheme == "data" and not url.lower().startswith("data:image/"):
            raise ValueError(f"Only image data URIs are supported: {url[:64]}")
        return super().fetch(url, headers)


_url_fetcher = ExportURLFetcher()


def convert_pdf(html: str) -> bytes:
    # The input is normalized once in convert_export (script/style stripped,
    # canvas image spans materialized, link schemes enforced).
    return HTML(string=html, url_fetcher=_url_fetcher).write_pdf()
