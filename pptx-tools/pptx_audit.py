#!/usr/bin/env python3
"""Strict OOXML package audit for PowerPoint-repair causes (zip, XML, content types, rels, ids, tables, media).
Usage: python3 pptx_audit.py deck.pptx   (needs lxml). Exit code is not set; read the issue-category count."""
import re, sys, zipfile, posixpath, collections
from lxml import etree

path = sys.argv[1]
z = zipfile.ZipFile(path)
names = z.namelist()
issues = collections.defaultdict(list)

def add(k, msg):
    issues[k].append(msg)

# --- zip level
if names[0] != "[Content_Types].xml":
    add("zip", f"first entry is {names[0]}, not [Content_Types].xml")
for n in names:
    if n.endswith("/"):
        add("zip", f"directory entry {n}")
dups = [n for n, c in collections.Counter(names).items() if c > 1]
for d in dups:
    add("zip", f"duplicate entry {d}")
bad = z.testzip()
if bad:
    add("zip", f"CRC error {bad}")

# --- well-formed XML
parsed = {}
for n in names:
    if n.endswith(".xml") or n.endswith(".rels"):
        try:
            parsed[n] = etree.fromstring(z.read(n))
        except Exception as e:
            add("xml", f"{n}: {e}")

# --- content types
ct = parsed.get("[Content_Types].xml")
CT = "{http://schemas.openxmlformats.org/package/2006/content-types}"
defaults = {}
overrides = {}
if ct is not None:
    for e in ct:
        if e.tag == CT + "Default":
            defaults[e.get("Extension").lower()] = e.get("ContentType")
        elif e.tag == CT + "Override":
            overrides[e.get("PartName")] = e.get("ContentType")
for pn in overrides:
    if pn.lstrip("/") not in names:
        add("content-types", f"Override for missing part {pn}")
for n in names:
    if n == "[Content_Types].xml" or n.endswith("/"):
        continue
    ext = n.rsplit(".", 1)[-1].lower()
    if "/" + n not in overrides and ext not in defaults:
        add("content-types", f"no content type for {n}")
for ext, t in defaults.items():
    if t in ("image/jpg",):
        add("content-types", f"bad MIME {t} for .{ext}")
dup_over = [p for p, c in collections.Counter(
    e.get("PartName") for e in ct if e.tag == CT + "Override").items() if c > 1]
for p in dup_over:
    add("content-types", f"duplicate Override {p}")

# --- relationships
R = "{http://schemas.openxmlformats.org/package/2006/relationships}"
for n, root in parsed.items():
    if not n.endswith(".rels"):
        continue
    base = posixpath.dirname(posixpath.dirname(n))  # folder of the source part
    ids = collections.Counter(r.get("Id") for r in root)
    for i, c in ids.items():
        if c > 1:
            add("rels", f"{n}: duplicate Id {i}")
    for r in root:
        if r.get("TargetMode") == "External":
            continue
        t = r.get("Target")
        full = posixpath.normpath(posixpath.join(base, t)) if not t.startswith("/") else t.lstrip("/")
        if full not in names:
            add("rels", f"{n}: Target {t} -> {full} missing")

# --- per-slide checks
P = "http://schemas.openxmlformats.org/presentationml/2006/main"
A = "http://schemas.openxmlformats.org/drawingml/2006/main"
RNS = "http://schemas.openxmlformats.org/officeDocument/2006/relationships"
ns = {"p": P, "a": A, "r": RNS}
# Adjust-guide names per ECMA-376 presetShapeDefinitions (only presets verified; others are not checked).
PRESET_GUIDES = {
    "rect": set(), "ellipse": set(), "line": set(), "diamond": set(), "straightConnector1": set(),
    "roundRect": {"adj"}, "triangle": {"adj"}, "chevron": {"adj"}, "homePlate": {"adj"},
    "parallelogram": {"adj"}, "trapezoid": {"adj"},
    "rightArrow": {"adj1", "adj2"}, "leftArrow": {"adj1", "adj2"}, "upArrow": {"adj1", "adj2"}, "downArrow": {"adj1", "adj2"},
}
ctrl = re.compile("[\x00-\x08\x0b\x0c\x0e-\x1f\ufffe\uffff]")
intattrs = {"x", "y", "cx", "cy", "w", "h", "sz", "val", "l", "t", "r", "b", "idx", "id"}

for n, root in sorted(parsed.items()):
    if not re.match(r"ppt/(slides|notesSlides|slideLayouts|slideMasters|notesMasters)/[^/]+\.xml$", n):
        continue
    raw = z.read(n).decode("utf-8")
    if ctrl.search(raw):
        add("chars", f"{n}: control/illegal char {ctrl.search(raw).group()!r}")
    # duplicate cNvPr ids
    ids = collections.Counter(e.get("id") for e in root.iter("{%s}cNvPr" % P))
    for i, c in ids.items():
        if c > 1:
            add("ids", f"{n}: duplicate cNvPr id={i} x{c}")
    # sp without txBody (PowerPoint tolerates only for non-text shapes? flag)
    for sp in root.iter("{%s}sp" % P):
        if sp.find("p:txBody", ns) is None:
            nv = sp.find("p:nvSpPr/p:cNvPr", ns)
            if "ph" not in etree.tostring(sp)[:400].decode() and nv is not None:
                add("sp-no-txbody", f"{n}: sp id={nv.get('id')} name={nv.get('name')}")
    # non-integer xfrm / ext / sizes
    for e in root.iter():
        tag = etree.QName(e).localname
        if tag in ("off", "ext", "chOff", "chExt") and e.get("uri") is None:
            for k, v in e.attrib.items():
                if not re.fullmatch(r"-?\d+", v):
                    add("non-int", f"{n}: <{tag} {k}={v}>")
                elif tag in ("ext", "chExt") and int(v) < 0:
                    add("neg-size", f"{n}: <{tag} {k}={v}>")
        if tag in ("rPr", "defRPr", "endParaRPr"):
            sz = e.get("sz")
            if sz is not None and (not re.fullmatch(r"\d+", sz) or not 100 <= int(sz) <= 400000):
                add("font-size", f"{n}: {tag} sz={sz}")
        if tag in ("spcPts", "spcPct", "lnSpc") and e.get("val") is not None:
            if not re.fullmatch(r"-?\d+", e.get("val")):
                add("non-int", f"{n}: <{tag} val={e.get('val')}>")
        if tag == "ln" and e.get("w") is not None and not re.fullmatch(r"\d+", e.get("w")):
            add("non-int", f"{n}: <ln w={e.get('w')}>")
        if tag == "srgbClr":
            if not re.fullmatch(r"[0-9A-Fa-f]{6}", e.get("val") or ""):
                add("color", f"{n}: srgbClr {e.get('val')}")
        if tag in ("alpha", "lumMod", "lumOff", "satMod", "tint", "shade") and e.get("val") is not None:
            if not re.fullmatch(r"-?\d+", e.get("val")):
                add("non-int", f"{n}: <{tag} val={e.get('val')}>")
        if tag == "rot" or (tag == "xfrm" and e.get("rot") is not None):
            v = e.get("rot")
            if v is not None and not re.fullmatch(r"-?\d+", v):
                add("non-int", f"{n}: xfrm rot={v}")
        if tag in ("bodyPr",):
            for k in ("lIns", "tIns", "rIns", "bIns"):
                v = e.get(k)
                if v is not None and not re.fullmatch(r"-?\d+", v):
                    add("non-int", f"{n}: bodyPr {k}={v}")
    # adjust guides must exist on the preset (ellipse/rect/line/diamond have none; roundRect has `adj`).
    # XSD and the Open XML SDK accept any name, but a preset given a guide it does not define is the only
    # structural difference between the bonupai decks that PowerPoint cannot repair and every deck that opens.
    for g in root.iter("{%s}prstGeom" % A):
        allowed = PRESET_GUIDES.get(g.get("prst"))
        if allowed is None:
            continue
        for gd in g.iter("{%s}gd" % A):
            if gd.get("name") not in allowed:
                add("preset-guide", f"{n}: prstGeom {g.get('prst')} has guide {gd.get('name')!r} (allowed {sorted(allowed)})")
    # r:embed / r:id reference resolution
    relp = posixpath.join(posixpath.dirname(n), "_rels", posixpath.basename(n) + ".rels")
    relids = set()
    if relp in parsed:
        relids = {r.get("Id") for r in parsed[relp]}
    for e in root.iter():
        for k, v in e.attrib.items():
            if k.startswith("{%s}" % RNS):
                if v not in relids:
                    add("rid", f"{n}: {etree.QName(e).localname} {k.split('}')[1]}={v} not in rels")
    # empty a:t is fine; empty txBody without a:p is not
    for tb in root.iter("{%s}txBody" % P):
        if tb.find("a:p", ns) is None:
            add("txbody-empty", f"{n}: txBody without a:p")
    # schema order in a:p: pPr must be first child
    for p in root.iter("{%s}p" % A):
        kids = [etree.QName(c).localname for c in p]
        if "pPr" in kids and kids.index("pPr") != 0:
            add("order", f"{n}: a:p has pPr not first {kids[:4]}")
        if kids.count("pPr") > 1:
            add("order", f"{n}: a:p has {kids.count('pPr')} pPr")
        if "endParaRPr" in kids and kids.index("endParaRPr") != len(kids) - 1:
            add("order", f"{n}: endParaRPr not last")
    # a:r must have a:t ; rPr before t
    for r in root.iter("{%s}r" % A):
        kids = [etree.QName(c).localname for c in r]
        if "t" not in kids:
            add("order", f"{n}: a:r without a:t")
        if "rPr" in kids and kids.index("rPr") != 0:
            add("order", f"{n}: a:r rPr not first")

# --- presentation.xml
pres = parsed.get("ppt/presentation.xml")
if pres is not None:
    sld = pres.findall(".//p:sldId", ns)
    ids = [s.get("id") for s in sld]
    if len(set(ids)) != len(ids):
        add("presentation", "duplicate sldId")
    for i in ids:
        if not (256 <= int(i) < 2147483648):
            add("presentation", f"sldId {i} out of range")
    rids = [s.get("{%s}id" % RNS) for s in sld]
    if len(set(rids)) != len(rids):
        add("presentation", "duplicate sldId r:id")
    # every slide part is referenced once
    prels = {r.get("Id"): r.get("Target") for r in parsed["ppt/_rels/presentation.xml.rels"]}
    targets = [prels.get(r) for r in rids]
    sl_parts = [n for n in names if re.match(r"ppt/slides/slide\d+\.xml$", n)]
    ref = {posixpath.normpath(posixpath.join("ppt", t)) for t in targets if t}
    for s in sl_parts:
        if s not in ref:
            add("presentation", f"orphan slide part {s}")

# --- notes slide must point to slide and notesMaster
for n in names:
    if re.match(r"ppt/notesSlides/_rels/.*\.rels$", n):
        tg = [r.get("Type").rsplit("/", 1)[-1] for r in parsed[n]]
        if "notesMaster" not in tg or "slide" not in tg:
            add("notes", f"{n}: rels types {tg}")

# --- docProps
for n in ("docProps/core.xml", "docProps/app.xml"):
    if n not in names:
        add("docprops", f"{n} missing")

# --- media files non-empty, images decodable
try:
    from PIL import Image
    import io
    for n in names:
        if n.startswith("ppt/media/"):
            b = z.read(n)
            if not b:
                add("media", f"{n}: empty")
                continue
            if n.lower().endswith((".png", ".jpg", ".jpeg", ".gif")):
                try:
                    Image.open(io.BytesIO(b)).verify()
                except Exception as e:
                    add("media", f"{n}: {e}")
except ImportError:
    pass

print(f"== {path}: {len(names)} entries, {len(issues)} issue categories")
for k, v in issues.items():
    print(f"[{k}] {len(v)}")
    for m in v[:8]:
        print("   ", m)
    if len(v) > 8:
        print(f"    ... +{len(v)-8} more")
sys.exit(1 if issues else 0)
