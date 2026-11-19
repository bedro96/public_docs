#!/usr/bin/env python3
"""Normalise a pptxgenjs-built .pptx so PowerPoint (not just LibreOffice/python-pptx) opens it.

Fixes, in place:
  1. Duplicate shape ids inside one slide/notes part (pptxgenjs gives a table's graphicFrame the same
     <p:cNvPr id> as a neighbouring shape). PowerPoint treats this as a corrupt part.
  2. ZIP directory entries (JSZip load/generate adds `_rels/`, `ppt/` ...), which OPC packages must not contain.
  3. Part order: [Content_Types].xml first, then _rels/.rels, as PowerPoint writes it.
  4. Known pptxgenjs defects that make PowerPoint show "repair" (gitbrent/PptxGenJS#1441, #1442, #1444, #1449):
     <p:sp> without <p:txBody>; <p:bgPr> without <a:effectLst/>; ghost slideMasterN Overrides in
     [Content_Types].xml; image/jpg MIME; unused Default extensions; notesMaster sharing theme1 with the deck.
  5. notesMaster placeholders PowerPoint strips-and-repairs (#1443): the notesMaster spTree is emptied; the
     notes-page size is set to PowerPoint's default; sldImg placeholders get no txBody (as PowerPoint writes it).
  6. Adjust guides on presets that define none (`ellipse` with `<a:gd name="adj">`) are dropped.

Usage: python3 pptx_sanitize.py deck.pptx [more.pptx ...]
"""
import re
import sys
import zipfile
from pathlib import Path

XML_PART = re.compile(r"^ppt/(slides|notesSlides)/[^/]+\.xml$")
CNVPR = re.compile(r'(<p:cNvPr\b[^>]*?\bid=")(\d+)(")')
# Renumbering is only safe when nothing refers to a shape id.
ID_REFS = re.compile(r'<p:timing\b|<a:stCxn\b|<a:endCxn\b|\bspid="')


def renumber(xml: str, name: str):
    ids = [int(m.group(2)) for m in CNVPR.finditer(xml)]
    if len(ids) == len(set(ids)):
        return xml, 0
    if ID_REFS.search(xml):
        raise SystemExit(f"{name}: duplicate ids AND id references; renumber by hand")
    seen, nxt, fixed = set(), max(ids) + 1, 0

    def sub(m):
        nonlocal nxt, fixed
        v = int(m.group(2))
        if v in seen:
            v, nxt, fixed = nxt, nxt + 1, fixed + 1
        seen.add(v)
        return f"{m.group(1)}{v}{m.group(3)}"

    return CNVPR.sub(sub, xml), fixed


EMPTY_TX = "<p:txBody><a:bodyPr/><a:lstStyle/><a:p><a:endParaRPr lang=\"en-US\"/></a:p></p:txBody>"
SP = re.compile(r"<p:sp>.*?</p:sp>", re.S)


def add_txbody(xml: str):
    n = 0

    def sub(m):
        nonlocal n
        # A notes-page slide-image placeholder never carries a txBody (PowerPoint writes none), so leave it alone.
        if "<p:txBody>" in m.group(0) or 'type="sldImg"' in m.group(0):
            return m.group(0)
        n += 1
        return m.group(0)[: -len("</p:sp>")] + EMPTY_TX + "</p:sp>"

    return SP.sub(sub, xml), n


def add_effectlst(xml: str):
    return re.sub(r"(<p:bgPr>(?:(?!</p:bgPr>).)*?)(</p:bgPr>)",
                  lambda m: m.group(0) if "<a:effectLst" in m.group(1) else m.group(1) + "<a:effectLst/>" + m.group(2),
                  xml, flags=re.S)


# Presets that define no adjust guide. pptxgenjs writes <a:gd name="adj"> for any shape given `rectRadius`
# (bonupai passed it to "ellipse" badges); PowerPoint cannot open/repair a preset carrying a guide it does not define.
NO_GUIDE_PRESETS = {"rect", "ellipse", "line", "diamond", "straightConnector1"}
PRST_GEOM = re.compile(r'<a:prstGeom prst="(\w+)">\s*<a:avLst>(.*?)</a:avLst>\s*</a:prstGeom>', re.S)


def strip_invalid_guides(xml: str):
    n = 0

    def sub(m):
        nonlocal n
        if m.group(1) not in NO_GUIDE_PRESETS or "<a:gd" not in m.group(2):
            return m.group(0)
        n += 1
        return f'<a:prstGeom prst="{m.group(1)}"><a:avLst/></a:prstGeom>'

    return PRST_GEOM.sub(sub, xml), n


NM_SPTREE = re.compile(r"(<p:spTree>.*?</p:grpSpPr>)(?:<p:sp>.*)?(</p:spTree>)", re.S)


def strip_notes_master_placeholders(xml: str):
    """Reduce the notesMaster spTree to its empty root group.

    PowerPoint (reported on Mac M365, gitbrent/PptxGenJ#1443, fixed upstream by PR #1458) drops the six
    hdr/dt/sldImg/body/ftr/sldNum placeholders pptxgenjs writes and then asks to repair the file. Mac-saved
    decks carry exactly this empty form (verified against microsoft_foundry/Entra-ID-tempates.pptx), so ship it
    pre-stripped. bg, clrMap and notesStyle are kept as they are.
    """
    if "<p:sp>" not in xml:
        return xml, 0
    return NM_SPTREE.sub(r"\1\2", xml, count=1), 1


def fix_notes_size(xml: str):
    """pptxgenjs writes a 6858000 x 12192000 notes page; PowerPoint's default is 6858000 x 9144000."""
    return re.sub(r'<p:notesSz cx="6858000" cy="12192000"/>', '<p:notesSz cx="6858000" cy="9144000"/>', xml)


def fix_package(files: dict):
    """files: name -> bytes (mutated). Content-types, notes theme, and per-part XML fixes."""
    stats = {"txBody": 0, "ghost": 0, "defaults": 0, "notes_theme": 0, "notes_master_ph": 0, "bad_guides": 0}
    nm = "ppt/notesMasters/notesMaster1.xml"
    if nm in files:
        xml, n = strip_notes_master_placeholders(files[nm].decode("utf-8"))
        files[nm] = xml.encode("utf-8")
        stats["notes_master_ph"] = n
    if "ppt/presentation.xml" in files:
        files["ppt/presentation.xml"] = fix_notes_size(files["ppt/presentation.xml"].decode("utf-8")).encode("utf-8")
    for name in list(files):
        if re.match(r"^ppt/(slides|notesSlides)/[^/]+\.xml$", name):
            xml = files[name].decode("utf-8")
            xml, n = add_txbody(xml)
            stats["txBody"] += n
            xml = add_effectlst(xml)
            xml, n = strip_invalid_guides(xml)
            stats["bad_guides"] += n
            files[name] = xml.encode("utf-8")
    # notesMaster needs its own theme part
    nrel = "ppt/notesMasters/_rels/notesMaster1.xml.rels"
    if nrel in files and "ppt/theme/theme2.xml" not in files:
        rel = files[nrel].decode("utf-8")
        if "../theme/theme1.xml" in rel:
            files["ppt/theme/theme2.xml"] = files["ppt/theme/theme1.xml"]
            files[nrel] = rel.replace("../theme/theme1.xml", "../theme/theme2.xml").encode("utf-8")
            ct = files["[Content_Types].xml"].decode("utf-8")
            if "/ppt/theme/theme2.xml" not in ct:
                m = re.search(r'<Override PartName="/ppt/theme/theme1.xml"[^>]*ContentType="([^"]+)"', ct)
                ctype = m.group(1) if m else "application/vnd.openxmlformats-officedocument.theme+xml"
                ct = ct.replace("</Types>", f'<Override PartName="/ppt/theme/theme2.xml" ContentType="{ctype}"/></Types>')
                files["[Content_Types].xml"] = ct.encode("utf-8")
            stats["notes_theme"] = 1
    ct = files["[Content_Types].xml"].decode("utf-8")
    before = len(ct)
    def ov(m):
        if ("/" + m.group(1).lstrip("/")).lstrip("/") in files:
            return m.group(0)
        stats["ghost"] += 1
        return ""
    ct = re.sub(r'<Override\s+PartName="([^"]+)"[^>]*/>', ov, ct)
    ct = ct.replace('Extension="jpg" ContentType="image/jpg"', 'Extension="jpg" ContentType="image/jpeg"')
    used = {"xml", "rels"} | {n.rsplit(".", 1)[-1].lower() for n in files if "." in n.rsplit("/", 1)[-1]}
    def df(m):
        if m.group(1).lower() in used:
            return m.group(0)
        stats["defaults"] += 1
        return ""
    ct = re.sub(r'<Default\s+Extension="([^"]+)"[^>]*/>', df, ct)
    files["[Content_Types].xml"] = ct.encode("utf-8")
    return stats


def sanitize(path: Path):
    src = zipfile.ZipFile(path)
    parts = [(i.filename, src.read(i.filename)) for i in src.infolist() if not i.filename.endswith("/")]
    src.close()
    files = dict(parts)
    stats = fix_package(files)
    parts = [(n, files.pop(n)) for n, _ in parts] + list(files.items())
    order = {"[Content_Types].xml": 0, "_rels/.rels": 1}
    parts.sort(key=lambda p: order.get(p[0], 2))  # stable: keeps the original order for the rest
    total = 0
    tmp = path.with_suffix(path.suffix + ".tmp")
    with zipfile.ZipFile(tmp, "w", zipfile.ZIP_DEFLATED, compresslevel=6) as out:
        for name, data in parts:
            if XML_PART.match(name):
                text, n = renumber(data.decode("utf-8"), name)
                total += n
                data = text.encode("utf-8")
            info = zipfile.ZipInfo(name, date_time=(2024, 1, 1, 0, 0, 0))
            info.compress_type = zipfile.ZIP_STORED if name.lower().endswith((".png", ".jpg", ".jpeg")) else zipfile.ZIP_DEFLATED
            out.writestr(info, data)
    tmp.replace(path)
    print(f"{path.name}: {len(parts)} parts, {total} duplicate shape ids renumbered, {stats}")


if __name__ == "__main__":
    for p in sys.argv[1:]:
        sanitize(Path(p))
