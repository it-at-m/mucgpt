from typing import Literal
from urllib.parse import urlparse

from bs4 import BeautifulSoup
from pydantic import BaseModel, Field

from config.settings import get_settings
from export.docx_converter import convert_docx
from export.xlsx_converter import convert_xlsx

# The editor limit (settings.canvas_editor_max_chars) counts text characters;
# the serialized HTML carries markup and separators on top, so 4× the editor
# limit is ample headroom.
_MAX_CONTENT_CHARS = 4 * get_settings().canvas_editor_max_chars


class ExportRequest(BaseModel):
    html: str = Field(max_length=_MAX_CONTENT_CHARS)
    target: Literal["pdf", "docx", "xlsx"]


_TARGETS: dict[str, tuple[str, str]] = {
    "pdf": ("application/pdf", "canvas.pdf"),
    "docx": (
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "canvas.docx",
    ),
    "xlsx": (
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "canvas.xlsx",
    ),
}

# Link schemes that survive export — exactly the ones the browser policy
# renders as clickable. The frontend never emits anything else; dropping
# other hrefs (javascript:, data:, relative, …) keeps their text and is
# defense in depth for direct API callers.
_LINK_SCHEMES = {"http", "https", "mailto"}


def normalize_export_html(html: str) -> str:
    """One shared input normalization for all export converters: strip
    script/style, materialize the editor's non-fetching canvas image spans
    into img tags (issue #228), and enforce the link scheme policy. The
    converters then see the same representation: real img tags, safe links.
    """
    soup = BeautifulSoup(html, "html.parser")
    for tag in soup.find_all(["script", "style"]):
        tag.decompose()
    for span in soup.find_all("span", attrs={"data-canvas-image-src": True}):
        img = soup.new_tag("img")
        img.attrs = {
            "src": str(span.get("data-canvas-image-src", "")),
            "alt": str(span.get("data-canvas-image-alt", "")),
        }
        span.replace_with(img)
    for anchor in soup.find_all("a", href=True):
        if urlparse(str(anchor["href"])).scheme not in _LINK_SCHEMES:
            del anchor["href"]
    return str(soup)


def convert_export(request: ExportRequest) -> tuple[bytes, str, str]:
    mimetype, filename = _TARGETS[request.target]
    html = normalize_export_html(request.html)
    match request.target:
        case "pdf":
            # imported lazily: weasyprint dlopens pango/gobject at import time
            from export.pdf_converter import convert_pdf

            data = convert_pdf(html)
        case "docx":
            data = convert_docx(html)
        case "xlsx":
            data = convert_xlsx(html)
    return data, mimetype, filename
