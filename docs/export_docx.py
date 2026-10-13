"""Export LUCE markdown docs to Word (.docx)."""
from __future__ import annotations

import re
from pathlib import Path

from docx import Document
from docx.enum.text import WD_ALIGN_PARAGRAPH
from docx.oxml.ns import qn
from docx.oxml import OxmlElement
from docx.shared import Inches, Pt, RGBColor

ROOT = Path(__file__).resolve().parent
OUT = ROOT / "word"

FILES = [
    ("01-PRD.md", "01-PRD-LUCE.docx"),
    ("02-TRD.md", "02-TRD-LUCE.docx"),
    ("03-App-Flow.md", "03-App-Flow-LUCE.docx"),
    ("04-Design-Brief.md", "04-Design-Brief-LUCE.docx"),
    ("05-Background-Schema.md", "05-Background-Schema-LUCE.docx"),
    ("06-Implementation-Plan.md", "06-Implementation-Plan-LUCE.docx"),
    ("07-Milestone-Testing.md", "07-Milestone-Testing-LUCE.docx"),
]


def set_run_font(run, size=11, bold=False, italic=False, code=False):
    run.bold = bold
    run.italic = italic
    run.font.size = Pt(size)
    run.font.name = "Consolas" if code else "Calibri"
    r = run._element
    rPr = r.get_or_add_rPr()
    rFonts = rPr.get_or_add_rFonts()
    rFonts.set(qn("w:ascii"), "Consolas" if code else "Calibri")
    rFonts.set(qn("w:hAnsi"), "Consolas" if code else "Calibri")
    if code:
        run.font.color.rgb = RGBColor(0x33, 0x33, 0x33)


def add_horizontal_line(doc: Document):
    p = doc.add_paragraph()
    pPr = p._p.get_or_add_pPr()
    pBdr = OxmlElement("w:pBdr")
    bottom = OxmlElement("w:bottom")
    bottom.set(qn("w:val"), "single")
    bottom.set(qn("w:sz"), "6")
    bottom.set(qn("w:space"), "1")
    bottom.set(qn("w:color"), "6D28D9")
    pBdr.append(bottom)
    pPr.append(pBdr)


def add_inline_runs(paragraph, text: str):
    # Split bold ** **, italic * *, inline code ` `
    pattern = re.compile(r"(\*\*[^*]+\*\*|\*[^*]+\*|`[^`]+`)")
    parts = pattern.split(text)
    for part in parts:
        if not part:
            continue
        if part.startswith("**") and part.endswith("**"):
            run = paragraph.add_run(part[2:-2])
            set_run_font(run, bold=True)
        elif part.startswith("*") and part.endswith("*") and not part.startswith("**"):
            run = paragraph.add_run(part[1:-1])
            set_run_font(run, italic=True)
        elif part.startswith("`") and part.endswith("`"):
            run = paragraph.add_run(part[1:-1])
            set_run_font(run, code=True, size=10)
        else:
            run = paragraph.add_run(part)
            set_run_font(run)


def parse_table(lines: list[str], start: int) -> tuple[list[list[str]], int]:
    rows = []
    i = start
    while i < len(lines) and lines[i].strip().startswith("|"):
        row = [c.strip() for c in lines[i].strip().strip("|").split("|")]
        # skip separator
        if all(re.match(r"^:?-+:?$", c) for c in row):
            i += 1
            continue
        rows.append(row)
        i += 1
    return rows, i


def add_table(doc: Document, rows: list[list[str]]):
    if not rows:
        return
    cols = max(len(r) for r in rows)
    table = doc.add_table(rows=len(rows), cols=cols)
    table.style = "Table Grid"
    for ri, row in enumerate(rows):
        for ci in range(cols):
            cell = table.rows[ri].cells[ci]
            cell.text = ""
            p = cell.paragraphs[0]
            val = row[ci] if ci < len(row) else ""
            add_inline_runs(p, val)
            if ri == 0:
                for run in p.runs:
                    run.bold = True
    doc.add_paragraph()


def md_to_docx(md_path: Path, docx_path: Path):
    text = md_path.read_text(encoding="utf-8")
    lines = text.splitlines()
    doc = Document()

    section = doc.sections[0]
    section.top_margin = Inches(0.85)
    section.bottom_margin = Inches(0.85)
    section.left_margin = Inches(0.95)
    section.right_margin = Inches(0.95)

    # Title page header from first H1
    i = 0
    while i < len(lines):
        line = lines[i]
        stripped = line.strip()

        if not stripped:
            i += 1
            continue

        # fenced code / mermaid
        if stripped.startswith("```"):
            lang = stripped[3:].strip()
            i += 1
            block = []
            while i < len(lines) and not lines[i].strip().startswith("```"):
                block.append(lines[i])
                i += 1
            i += 1  # closing ```
            label = "Flow diagram (Mermaid)" if lang == "mermaid" else ("Code" if lang else "Block")
            p = doc.add_paragraph()
            run = p.add_run(f"[{label}]")
            set_run_font(run, italic=True, size=10, bold=True)
            run.font.color.rgb = RGBColor(0x6D, 0x28, 0xD9)
            for bline in block:
                cp = doc.add_paragraph()
                cp.paragraph_format.left_indent = Inches(0.15)
                cp.paragraph_format.space_after = Pt(0)
                cr = cp.add_run(bline)
                set_run_font(cr, code=True, size=9)
            doc.add_paragraph()
            continue

        # headings
        if stripped.startswith("#"):
            level = len(stripped) - len(stripped.lstrip("#"))
            title = stripped[level:].strip()
            if level == 1:
                h = doc.add_heading(title, level=0)
                for run in h.runs:
                    run.font.color.rgb = RGBColor(0x4C, 0x1D, 0x95)
            else:
                h = doc.add_heading(title, level=min(level, 3))
                for run in h.runs:
                    run.font.color.rgb = RGBColor(0x5B, 0x21, 0xB6)
            i += 1
            continue

        # hr
        if stripped in ("---", "***", "___"):
            add_horizontal_line(doc)
            i += 1
            continue

        # table
        if stripped.startswith("|") and i + 1 < len(lines) and lines[i + 1].strip().startswith("|"):
            rows, i = parse_table(lines, i)
            add_table(doc, rows)
            continue

        # blockquote
        if stripped.startswith(">"):
            quote = stripped.lstrip("> ").strip()
            p = doc.add_paragraph()
            p.paragraph_format.left_indent = Inches(0.25)
            add_inline_runs(p, quote)
            for run in p.runs:
                run.italic = True
            i += 1
            continue

        # checklist / bullets
        m_check = re.match(r"^- \[([ xX])\]\s+(.*)$", stripped)
        if m_check:
            mark = "☑" if m_check.group(1).lower() == "x" else "☐"
            p = doc.add_paragraph(style="List Bullet")
            add_inline_runs(p, f"{mark} {m_check.group(2)}")
            i += 1
            continue

        if re.match(r"^[-*]\s+", stripped):
            p = doc.add_paragraph(style="List Bullet")
            add_inline_runs(p, re.sub(r"^[-*]\s+", "", stripped))
            i += 1
            continue

        if re.match(r"^\d+\.\s+", stripped):
            p = doc.add_paragraph(style="List Number")
            add_inline_runs(p, re.sub(r"^\d+\.\s+", "", stripped))
            i += 1
            continue

        # normal paragraph
        p = doc.add_paragraph()
        add_inline_runs(p, stripped)
        i += 1

    # footer
    footer = section.footer
    fp = footer.paragraphs[0]
    fp.alignment = WD_ALIGN_PARAGRAPH.CENTER
    fr = fp.add_run("LUCE — Bring Your Product to Light.  |  Confidential academic document")
    set_run_font(fr, size=8, italic=True)
    fr.font.color.rgb = RGBColor(0x66, 0x66, 0x66)

    docx_path.parent.mkdir(parents=True, exist_ok=True)
    doc.save(docx_path)
    print(f"Wrote {docx_path.name}")


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    for src, dest in FILES:
        md_to_docx(ROOT / src, OUT / dest)
    print(f"Done. Folder: {OUT}")


if __name__ == "__main__":
    main()
