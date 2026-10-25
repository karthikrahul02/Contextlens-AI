import fitz
import pymupdf

from pathlib import Path
from typing import TypedDict

import fitz  # pip install pymupdf
from docx import Document  # pip install python-docx
from docx.table import Table
from docx.text.paragraph import Paragraph


class ExtractedPage(TypedDict):
    page_number: int
    text: str


def extract_pdf(file_path: str) -> list[ExtractedPage]:
    """Extract text from a PDF while preserving page numbers."""
    pages: list[ExtractedPage] = []

    try:
        with fitz.open(file_path) as pdf:
            if pdf.needs_pass:
                raise ValueError("PDF is password-protected.")

            for page_index in range(pdf.page_count):
                page = pdf.load_page(page_index)
                raw_text = page.get_text("text", sort=True)

                if not isinstance(raw_text, str):
                    raise ValueError("Unexpected PDF extraction result.")

                text = raw_text.strip()
                if text:
                    pages.append({"page_number": page_index + 1, "text": text})

    except ValueError:
        raise
    except Exception as exc:
        raise ValueError(f"Could not read PDF: {exc}") from exc

    if not pages:
        raise ValueError(
            "No extractable text found in PDF. "
            "It may be scanned or image-based and require OCR."
        )

    return pages


def extract_txt(file_path: str) -> list[ExtractedPage]:
    """Extract text from a TXT file."""
    try:
        text = Path(file_path).read_text(
            encoding="utf-8-sig",
            errors="replace",
        ).strip()
    except OSError as exc:
        raise ValueError(f"Could not read TXT file: {exc}") from exc

    if not text:
        raise ValueError("TXT file is empty.")

    return [{"page_number": 1, "text": text}]


def _table_to_text(table: Table) -> str:
    """Convert a DOCX table into readable text."""
    lines: list[str] = []

    for row in table.rows:
        cells: list[str] = []
        seen_cells: set[int] = set()

        for cell in row.cells:
            cell_id = id(cell._tc)
            if cell_id in seen_cells:
                continue
            seen_cells.add(cell_id)
            cells.append(cell.text.strip())

        if any(cells):
            lines.append(" | ".join(cells))

    return "\n".join(lines)


def extract_docx(file_path: str) -> list[ExtractedPage]:
    """Extract DOCX paragraphs and tables in document order."""
    try:
        doc = Document(file_path)
        parts: list[str] = []

        for child in doc.element.body.iterchildren():
            if child.tag.endswith("}p"):
                text = Paragraph(child, doc).text.strip()
            elif child.tag.endswith("}tbl"):
                text = _table_to_text(Table(child, doc))
            else:
                continue

            if text:
                parts.append(text)

        text = "\n\n".join(parts).strip()

    except Exception as exc:
        raise ValueError(f"Could not read DOCX file: {exc}") from exc

    if not text:
        raise ValueError("No extractable text found in DOCX.")

    return [{"page_number": 1, "text": text}]


def extract_document(file_path: str) -> list[ExtractedPage]:
    """Dispatch document extraction based on extension."""
    extension = Path(file_path).suffix.lower()

    if extension == ".pdf":
        return extract_pdf(file_path)
    if extension == ".txt":
        return extract_txt(file_path)
    if extension == ".docx":
        return extract_docx(file_path)

    raise ValueError(
        f"Unsupported file format: {extension}. "
        "Supported formats: PDF, TXT, DOCX."
    )