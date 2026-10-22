from io import BytesIO
from typing import Any

from bs4 import BeautifulSoup, NavigableString, Tag
from docx import Document
from docx.opc.constants import RELATIONSHIP_TYPE as RT
from docx.oxml import OxmlElement
from docx.oxml.ns import qn

_MONO_FONT = "Courier New"

_LIST_STYLES = {
    (False, 1): "List Bullet",
    (False, 2): "List Bullet 2",
    (False, 3): "List Bullet 3",
    (True, 1): "List Number",
    (True, 2): "List Number 2",
    (True, 3): "List Number 3",
}

# Tiptap's GFM schema is the gatekeeper; span/mark (v1.1 colors) are not
# produced yet and degrade to plain runs here.
_INLINE_FORMAT: dict[str, dict[str, bool]] = {
    "strong": {"bold": True},
    "b": {"bold": True},
    "em": {"italic": True},
    "i": {"italic": True},
    "s": {"strike": True},
    "del": {"strike": True},
    "code": {"mono": True},
}


_MAX_COLSPAN = 32
_MAX_TABLE_WIDTH = 32
_MAX_TABLE_ROWS = 1_000
# python-docx merges are quadratic in cost; bound their total per table so a
# colspan-heavy payload cannot dominate request latency.
_MERGE_BUDGET = 256


def _add_run(
    paragraph: Any,
    text: str,
    *,
    bold: bool = False,
    italic: bool = False,
    strike: bool = False,
    mono: bool = False,
) -> None:
    run = paragraph.add_run(text)
    if bold:
        run.bold = True
    if italic:
        run.italic = True
    if strike:
        run.font.strike = True
    if mono:
        run.font.name = _MONO_FONT


def _add_hyperlink(paragraph: Any, url: str, text: str) -> None:
    if not url:
        _add_run(paragraph, text)
        return
    # python-docx has no public hyperlink API, so the OOXML must be assembled directly.
    r_id = paragraph.part.relate_to(url, RT.HYPERLINK, is_external=True)
    hyperlink = OxmlElement("w:hyperlink")
    hyperlink.set(qn("r:id"), r_id)
    run = OxmlElement("w:r")
    r_pr = OxmlElement("w:rPr")
    color = OxmlElement("w:color")
    color.set(qn("w:val"), "0563C1")
    r_pr.append(color)
    underline = OxmlElement("w:u")
    underline.set(qn("w:val"), "single")
    r_pr.append(underline)
    run.append(r_pr)
    text_element = OxmlElement("w:t")
    text_element.text = text
    run.append(text_element)
    hyperlink.append(run)
    paragraph._p.append(hyperlink)


def _walk_inline(paragraph: Any, element: Any, **fmt: bool) -> None:
    if isinstance(element, NavigableString):
        if str(element).strip() or paragraph.text:
            _add_run(paragraph, str(element), **fmt)
        return
    name = element.name
    if name == "br":
        paragraph.add_run().add_break()
        return
    if name == "a":
        _add_hyperlink(paragraph, element.get("href", ""), element.get_text())
        return
    child_fmt = {**fmt, **_INLINE_FORMAT.get(name, {})}
    for child in element.children:
        _walk_inline(paragraph, child, **child_fmt)


def _render_list(doc: Any, tag: Tag, *, ordered: bool, level: int = 1) -> None:
    style = _LIST_STYLES[(ordered, min(level, 3))]
    for item in tag.find_all("li", recursive=False):
        paragraph = doc.add_paragraph(style=style)
        for child in item.children:
            if isinstance(child, Tag) and child.name in {"ul", "ol"}:
                _render_list(doc, child, ordered=child.name == "ol", level=level + 1)
            else:
                _walk_inline(paragraph, child)


def _render_blockquote(doc: Any, tag: Tag) -> None:
    inner = tag.find_all("p", recursive=False) or [tag]
    for paragraph_tag in inner:
        _walk_inline(doc.add_paragraph(style="Quote"), paragraph_tag)


def _render_code_block(doc: Any, tag: Tag) -> None:
    paragraph = doc.add_paragraph()
    lines = tag.get_text().split("\n")
    for index, line in enumerate(lines):
        run = paragraph.add_run(line)
        run.font.name = _MONO_FONT
        if index < len(lines) - 1:
            run.add_break()


def _render_horizontal_rule(doc: Any) -> None:
    paragraph = doc.add_paragraph()
    p_pr = paragraph._p.get_or_add_pPr()
    p_bdr = OxmlElement("w:pBdr")
    bottom = OxmlElement("w:bottom")
    bottom.set(qn("w:val"), "single")
    bottom.set(qn("w:sz"), "6")
    bottom.set(qn("w:space"), "1")
    bottom.set(qn("w:color"), "auto")
    p_bdr.append(bottom)
    p_pr.append(p_bdr)


def _fill_cell(cell: Any, tag: Tag, *, header: bool) -> None:
    paragraph = cell.paragraphs[0]
    if header:
        _add_run(paragraph, tag.get_text(strip=True), bold=True)
    else:
        _walk_inline(paragraph, tag)


def _colspan(cell: Any) -> int:
    try:
        span = int(cell.get("colspan", 1))
    except (TypeError, ValueError):
        return 1
    return min(max(span, 1), _MAX_COLSPAN)


def _render_table(doc: Any, tag: Tag) -> None:
    rows = tag.find_all("tr")[:_MAX_TABLE_ROWS]
    if not rows:
        return
    width = min(
        max(sum(_colspan(cell) for cell in row.find_all(["th", "td"])) for row in rows),
        _MAX_TABLE_WIDTH,
    )
    table = doc.add_table(rows=len(rows), cols=width)
    table.style = "Table Grid"
    budget = _MERGE_BUDGET
    for row_index, row in enumerate(rows):
        column = 0
        for cell in row.find_all(["th", "td"]):
            if column >= width:
                break
            span = min(_colspan(cell), width - column, budget + 1)
            target = table.rows[row_index].cells[column]
            for offset in range(1, span):
                target = target.merge(table.rows[row_index].cells[column + offset])
            budget -= span - 1
            _fill_cell(target, cell, header=cell.name == "th")
            column += span


def _render_block(doc: Any, tag: Tag) -> None:
    if tag.name in {"h1", "h2", "h3", "h4", "h5", "h6"}:
        level = int(tag.name[1])
        _walk_inline(doc.add_paragraph(style=f"Heading {level}"), tag)
    elif tag.name == "p":
        _walk_inline(doc.add_paragraph(), tag)
    elif tag.name in {"ul", "ol"}:
        _render_list(doc, tag, ordered=tag.name == "ol")
    elif tag.name == "blockquote":
        _render_blockquote(doc, tag)
    elif tag.name == "pre":
        _render_code_block(doc, tag)
    elif tag.name == "hr":
        _render_horizontal_rule(doc)
    elif tag.name == "table":
        _render_table(doc, tag)
    else:
        _walk_inline(doc.add_paragraph(), tag)


def convert_docx(html: str) -> bytes:
    soup = BeautifulSoup(html, "html.parser")
    doc = Document()
    for element in soup.children:
        if isinstance(element, Tag):
            _render_block(doc, element)
        elif isinstance(element, NavigableString) and element.strip():
            _walk_inline(doc.add_paragraph(), element)
    buffer = BytesIO()
    doc.save(buffer)
    return buffer.getvalue()
