from typing import Literal

from pydantic import BaseModel

from export.docx_converter import convert_docx
from export.xlsx_converter import convert_xlsx


class ExportRequest(BaseModel):
    markdown: str
    html: str
    doc_json: str
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


def convert_export(request: ExportRequest) -> tuple[bytes, str, str]:
    mimetype, filename = _TARGETS[request.target]
    match request.target:
        case "pdf":
            # imported lazily: weasyprint dlopens pango/gobject at import time
            from export.pdf_converter import convert_pdf

            data = convert_pdf(request.html)
        case "docx":
            data = convert_docx(request.html)
        case "xlsx":
            data = convert_xlsx(request.html)
    return data, mimetype, filename
