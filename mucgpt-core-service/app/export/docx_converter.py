import base64
import re
from io import BytesIO
from typing import Any

from bs4 import BeautifulSoup, NavigableString, Tag
from docx import Document
from docx.opc.constants import RELATIONSHIP_TYPE as RT
from docx.oxml import OxmlElement
from docx.oxml.ns import qn
from PIL import Image, ImageOps

from export.image_fetcher import IMAGE_DATA_MIMES, fetch_allowed_image

_MONO_FONT = "Courier New"

# Image sources from the export HTML: data URIs (approved images inlined in
# the frontend) and https URLs on allowed_link_domains hosts (fetched by
# _load_image_bytes); anything else degrades to its alt text. python-docx
# parses the IMAGE_DATA_MIMES headers itself — everything else goes through
# the Pillow re-encode in _reencode_to_png (or degrades).
_DATA_IMAGE_RE = re.compile(
    rf"^data:image/(?:{'|'.join(sorted(m.removeprefix('image/') for m in IMAGE_DATA_MIMES))});base64,([A-Za-z0-9+/=]+)$"
)

_LIST_STYLES = {
    (False, 1): "List Bullet",
    (False, 2): "List Bullet 2",
    (False, 3): "List Bullet 3",
    (True, 1): "List Number",
    (True, 2): "List Number 2",
    (True, 3): "List Number 3",
}

# The canvas schema produces GFM nodes plus the deployment-whitelisted raw HTML
# tags (e.g. <u>); anything else degrades to plain runs here.
_INLINE_FORMAT: dict[str, dict[str, bool]] = {
    "strong": {"bold": True},
    "b": {"bold": True},
    "em": {"italic": True},
    "i": {"italic": True},
    "s": {"strike": True},
    "del": {"strike": True},
    "u": {"underline": True},
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
    underline: bool = False,
    mono: bool = False,
) -> None:
    run = paragraph.add_run(text)
    if bold:
        run.bold = True
    if italic:
        run.italic = True
    if strike:
        run.font.strike = True
    if underline:
        run.underline = True
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


def _decode_data_image(src: str) -> bytes | None:
    match = _DATA_IMAGE_RE.match(src.strip())
    if not match:
        return None
    try:
        return base64.b64decode(match.group(1), validate=True)
    except ValueError:
        return None


def _reencode_to_png(raw: bytes) -> bytes | None:
    """Re-encode through Pillow for images python-docx cannot parse (e.g.
    JPEGs without JFIF/EXIF metadata, which many photo services strip);
    exif_transpose keeps the pixel orientation while metadata is dropped.
    Pillow lacking the codec (e.g. AVIF) also degrades here."""
    try:
        with Image.open(BytesIO(raw)) as image:
            upright = ImageOps.exif_transpose(image)
            buffer = BytesIO()
            upright.save(buffer, format="PNG")
            return buffer.getvalue()
    except Exception:
        return None


def _load_image_bytes(src: str) -> bytes | None:
    """Data URIs are decoded; allowlisted-host URLs are fetched server-side
    (the deployment trusts these hosts for images exactly like for clickable
    links). Other sources degrade."""
    if src.startswith(("http://", "https://")):
        fetched = fetch_allowed_image(src)
        return fetched[0] if fetched else None
    return _decode_data_image(src)


def _add_image(paragraph: Any, src: str, alt: str) -> None:
    """Render an img tag as an inline picture; undecodable images degrade to
    their alt text instead of failing the export."""
    raw = _load_image_bytes(src)
    if raw is None:
        if alt:
            _add_run(paragraph, alt)
        return
    try:
        paragraph.add_run().add_picture(BytesIO(raw))
    except Exception:
        # python-docx's own header parsers only cover a subset of encodings
        # (e.g. JPEGs without APP0/APP1 raise); Pillow's decoders are more
        # complete, so re-encode and retry before giving up.
        normalized = _reencode_to_png(raw)
        if normalized is None:
            if alt:
                _add_run(paragraph, alt)
            return
        try:
            paragraph.add_run().add_picture(BytesIO(normalized))
        except Exception:
            if alt:
                _add_run(paragraph, alt)


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
        # A link with no text but an attached image (e.g. a linked
        # screenshot) renders the picture; python-docx hyperlinks cannot
        # contain runs with images.
        if not element.get_text(strip=True) and element.find("img"):
            _walk_inline(paragraph, element)
            return
        _add_hyperlink(paragraph, element.get("href", ""), element.get_text())
        return
    if name == "img":
        _add_image(paragraph, element.get("src", ""), element.get("alt", ""))
        return
    child_fmt = {**fmt, **_INLINE_FORMAT.get(name, {})}
    for child in element.children:
        _walk_inline(paragraph, child, **child_fmt)


def _render_list(doc: Any, tag: Tag, *, ordered: bool, level: int = 1) -> None:
    style = _LIST_STYLES[(ordered, min(level, 3))]
    # Each ordered list gets its own numbering instance: the Word list styles
    # all point at one shared per-document counter, so without an override the
    # lists continue each other (2., 3., …) instead of restarting. Nested
    # lists at deeper style levels restart too, which matches their fresh
    # indentation.
    numbering_id = (
        _new_list_number(doc, start=_ordered_list_start(tag)) if ordered else None
    )
    for item in tag.find_all("li", recursive=False):
        paragraph = _add_list_paragraph(doc, style, numbering_id, level)
        # Content that follows a nested list must not merge into the parent
        # item's paragraph; it becomes an unnumbered continuation instead.
        past_nested_list = False
        for child in item.children:
            if isinstance(child, Tag) and child.name in {"ul", "ol"}:
                _render_list(doc, child, ordered=child.name == "ol", level=level + 1)
                past_nested_list = True
            else:
                if past_nested_list:
                    paragraph = doc.add_paragraph(style=style)
                    _suppress_numbering(paragraph)
                    past_nested_list = False
                _walk_inline(paragraph, child)


def _ordered_list_start(tag: Tag) -> int:
    raw = tag.get("start")
    if not isinstance(raw, str):
        return 1
    try:
        return max(int(raw), 1)
    except ValueError:
        return 1


def _add_list_paragraph(
    doc: Any, style: str, numbering_id: int | None, level: int
) -> Any:
    paragraph = doc.add_paragraph(style=style)
    if numbering_id is not None:
        container = paragraph._p.get_or_add_pPr().get_or_add_numPr()
        container.get_or_add_ilvl().val = level - 1
        container.get_or_add_numId().val = numbering_id
    return paragraph


def _suppress_numbering(paragraph: Any) -> None:
    container = paragraph._p.get_or_add_pPr().get_or_add_numPr()
    container.get_or_add_numId().val = 0


def _new_list_number(doc: Any, start: int) -> int | None:
    """Add a numbering instance referencing the `List Number` abstract
    definition; returns its numId or None when the template lacks it."""
    try:
        numbering = doc.part.numbering_part.element
        style_numbering = (
            doc.styles["List Number"].element.find(qn("w:pPr")).find(qn("w:numPr"))
        )
        style_num_id = int(style_numbering.find(qn("w:numId")).get(qn("w:val")))
        abstract_id = (
            numbering.find(f'{qn("w:num")}[@{qn("w:numId")}="{style_num_id}"]')
            .find(qn("w:abstractNumId"))
            .get(qn("w:val"))
        )
        new_id = (
            max(
                (int(el.get(qn("w:numId"))) for el in numbering.findall(qn("w:num"))),
                default=0,
            )
            + 1
        )
    except (AttributeError, TypeError, ValueError):
        return None
    instance = OxmlElement("w:num")
    instance.set(qn("w:numId"), str(new_id))
    reference = OxmlElement("w:abstractNumId")
    reference.set(qn("w:val"), abstract_id)
    instance.append(reference)
    override = OxmlElement("w:lvlOverride")
    override.set(qn("w:ilvl"), "0")
    restart = OxmlElement("w:startOverride")
    restart.set(qn("w:val"), str(start))
    override.append(restart)
    instance.append(override)
    numbering.append(instance)
    return new_id


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


def _clamp_inline_image_widths(doc: Any) -> None:
    """Scale pictures that exceed the usable page width proportionally
    (python-docx derives the native size from image headers at ~72 dpi,
    which overflows the page for typical screenshots)."""
    section = doc.sections[0]
    usable = section.page_width - section.left_margin - section.right_margin
    for shape in doc.inline_shapes:
        if shape.width > usable:
            ratio = usable / shape.width
            shape.width = int(shape.width * ratio)
            shape.height = int(shape.height * ratio)


def convert_docx(html: str) -> bytes:
    soup = BeautifulSoup(html, "html.parser")
    doc = Document()
    for element in soup.children:
        if isinstance(element, Tag):
            _render_block(doc, element)
        elif isinstance(element, NavigableString) and element.strip():
            _walk_inline(doc.add_paragraph(), element)
    _clamp_inline_image_widths(doc)
    buffer = BytesIO()
    doc.save(buffer)
    return buffer.getvalue()
