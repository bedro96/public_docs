// Post-process for pptxgenjs native charts: put chart XML children into ECMA-376 (OOXML) schema order.
//
// WHY THIS EXISTS
//   pptxgenjs writes ppt/charts/chart*.xml with child elements in an order that violates the DrawingML chart
//   schema (dml-chart.xsd). `validate.py` (the pptx skill's XSD validator) then fails with errors such as
//     "axId: This element is not expected. Expected is ( extLst )"
//     "dPt:  This element is not expected. Expected is one of ( trendline, errBars, cat, val, ... )"
//   Offending patterns pptxgenjs emits (identical on every build, nothing to do with our slide content):
//     1. <c:ser> in a bar chart with per-point colours: <c:dLbls> is written BEFORE the <c:dPt> elements,
//        but CT_BarSer is  idx, order, tx, spPr, invertIfNegative, pictureOptions, dPt*, dLbls, trendline*,
//        errBars, cat, val, shape, extLst  -> dPt must precede dLbls.
//     2. 2D <c:barChart> always ends with THREE <c:axId> (the third is the series axis of the 3D variant, and
//        it points at a <c:serAx> that is never declared in <c:plotArea>). CT_BarChart allows exactly two.
//   PowerPoint is lenient about (1) but a dangling axis reference like (2) is a repair-prompt risk, and strict
//   consumers (validator, some converters) reject both.
//
// WHAT IT DOES (and does not do)
//   - Re-sorts the children of <c:ser>, <c:dPt>, <c:dLbls>/<c:dLbl> and of every chart-group element
//     (<c:barChart>, <c:lineChart>, <c:pieChart>, ...) into schema order. This is a pure reorder: no element,
//     attribute, text value, cached number or label is added, changed or dropped.
//   - The ONE removal: an <c:axId> inside a chart group whose value is not the axId of any axis that is actually
//     declared in the same <c:plotArea> (catAx/valAx/dateAx/serAx), and only while >= 2 referenced axes remain.
//     That is a dangling pointer, not data. A valid third axis of a real 3D chart is kept.
//   - Anything unknown, or any node with comments/CDATA/non-whitespace text between its children, is left
//     byte-for-byte untouched and reported in `warnings`, so a new pptxgenjs quirk surfaces instead of hiding.
//
// SCOPE
//   Verified against pptxgenjs BAR / BAR3D / PIE / DOUGHNUT charts (the only ones these decks use). pptxgenjs
//   LINE / AREA / RADAR / SCATTER / BUBBLE charts have further generator defects that are NOT ordering problems
//   (missing <c:grouping>, <c:invertIfNegative> inside non-bar series, <c:auto> in <c:valAx>); fixing those means
//   adding/removing elements, which this reorder-only step deliberately does not do. validate.py will still flag them.
//
// WHEN IT TRIGGERS
//   It is applied to every ppt/charts/chart*.xml on every build, but it is idempotent: a chart that is already
//   in schema order is not rewritten (`changedCharts` stays 0). It is the fallback for a generator bug; if a
//   future pptxgenjs release fixes its output the step simply becomes a no-op.
//
// HOW IT STAYS SAFE
//   The XML is tokenised into a lossless tree (tag/text tokens kept as raw strings, entities never decoded) and
//   serialised back by concatenation; the tokeniser asserts the round trip is exact before anything is touched.
//   Ordering uses ONE total order per element kind that is the union of the per-chart-type schema sequences
//   (each type's own sequence is a subsequence of the union) with a stable sort, so elements that share a name
//   (several <c:ser>, <c:dPt>, <c:axId>) keep their relative order.

const C_NS = "http://schemas.openxmlformats.org/drawingml/2006/chart";

// Union of CT_BarSer / CT_LineSer / CT_PieSer / CT_AreaSer / CT_ScatterSer / CT_RadarSer / CT_BubbleSer / CT_SurfaceSer.
const SER = ["idx", "order", "tx", "spPr", "explosion", "invertIfNegative", "pictureOptions", "marker", "dPt", "dLbls", "trendline", "errBars", "cat", "val", "xVal", "yVal", "bubbleSize", "shape", "smooth", "bubble3D", "extLst"];
// CT_DPt
const DPT = ["idx", "invertIfNegative", "marker", "bubble3D", "explosion", "spPr", "pictureOptions", "extLst"];
// CT_DLbls (dLbl* first, then delete | Group_DLbls) and CT_DLbl (idx, delete | layout, tx, Group_DLbl)
const DLBLS = ["dLbl", "delete", "numFmt", "spPr", "txPr", "dLblPos", "showLegendKey", "showVal", "showCatName", "showSerName", "showPercent", "showBubbleSize", "separator", "showLeaderLines", "leaderLines", "extLst"];
const DLBL = ["idx", "delete", "layout", "tx", "numFmt", "spPr", "txPr", "dLblPos", "showLegendKey", "showVal", "showCatName", "showSerName", "showPercent", "showBubbleSize", "separator", "extLst"];
// Union of CT_BarChart / CT_Bar3DChart / CT_LineChart / CT_PieChart / CT_DoughnutChart / CT_AreaChart / CT_ScatterChart / CT_RadarChart / CT_BubbleChart.
const GROUP = ["barDir", "grouping", "scatterStyle", "radarStyle", "varyColors", "ser", "dLbls", "dropLines", "hiLowLines", "upDownBars", "marker", "smooth", "firstSliceAng", "holeSize", "bubble3D", "bubbleScale", "showNegBubbles", "sizeRepresents", "gapWidth", "overlap", "gapDepth", "serLines", "shape", "axId", "extLst"];

const GROUP_NAMES = new Set(["barChart", "bar3DChart", "lineChart", "line3DChart", "pieChart", "pie3DChart", "doughnutChart", "areaChart", "area3DChart", "scatterChart", "radarChart", "bubbleChart"]);
const AXIS_NAMES = new Set(["catAx", "valAx", "dateAx", "serAx"]);
const ORDERS = { ser: SER, dPt: DPT, dLbls: DLBLS, dLbl: DLBL };

// Lossless tokeniser: every character of the input lands in exactly one token.
function tokenise(xml) {
  const re = /<!--[\s\S]*?-->|<!\[CDATA\[[\s\S]*?\]\]>|<\?[\s\S]*?\?>|<![^>]*>|<\/[^>\s]+\s*>|<[^>\s/!?][^>]*>|[^<]+/g;
  const tokens = [];
  let m;
  while ((m = re.exec(xml))) tokens.push(m[0]);
  if (tokens.join("") !== xml) throw new Error("chart XML tokeniser is not lossless");
  return tokens;
}

// Tree of raw tokens: element = { name (with prefix), open, close ("" if self-closing), children[] }; text/other = { raw }.
function parse(tokens) {
  const root = { children: [] };
  const stack = [root];
  for (const t of tokens) {
    const top = stack[stack.length - 1];
    if (/^<\/[^>\s]/.test(t)) {
      const el = stack.pop();
      if (!el.name || t.slice(2).replace(/\s*>$/, "") !== el.name) throw new Error(`mismatched ${t} in chart XML`);
      el.close = t;
    } else if (/^<[^!?/]/.test(t)) {
      const el = { name: t.slice(1).match(/^[^\s/>]+/)[0], open: t, close: "", children: [] };
      top.children.push(el);
      if (!/\/>$/.test(t)) stack.push(el);
    } else top.children.push({ raw: t });
  }
  if (stack.length !== 1) throw new Error("unclosed element in chart XML");
  return root;
}

function serialise(node) {
  if (node.raw !== undefined) return node.raw;
  const inner = node.children.map(serialise).join("");
  return node.name ? node.open + inner + node.close : inner;
}

const local = (name) => name.replace(/^[^:]*:/, "");
const attr = (el, a) => (el.open.match(new RegExp(`\\s${a}="([^"]*)"`)) || [])[1];

// Stable-sort the element children of `el` into `order`. Returns true if the child sequence changed.
function reorder(el, order, prefix, ctx) {
  if (el.children.some((k) => k.raw !== undefined && k.raw.trim() !== "")) {
    ctx.warnings.push(`<${el.name}>: non-element content between children, left untouched`);
    return false;
  }
  const kids = el.children.filter((k) => k.raw === undefined);
  const rank = kids.map((k) => (k.name.startsWith(prefix) ? order.indexOf(local(k.name)) : -1));
  if (rank.includes(-1)) {
    ctx.warnings.push(`<${el.name}>: unknown child <${kids[rank.indexOf(-1)].name}>, left untouched`);
    return false;
  }
  const sorted = kids.map((k, i) => ({ k, r: rank[i] })).sort((a, b) => a.r - b.r).map((x) => x.k);
  if (sorted.every((k, i) => k === kids[i])) return false;
  el.children = sorted; // whitespace-only text between children is insignificant in element-only content
  return true;
}

function walk(node, prefix, ctx) {
  if (node.name && node.name.startsWith(prefix)) {
    const n = local(node.name);
    const order = ORDERS[n] || (GROUP_NAMES.has(n) ? GROUP : null);
    if (order && reorder(node, order, prefix, ctx)) ctx.moved++;
  }
  for (const c of node.children || []) if (c.name) walk(c, prefix, ctx);
}

// Drop <c:axId> references in chart groups that point at no declared axis (see header, 2D barChart quirk).
function dropDanglingAxIds(plotArea, prefix, ctx) {
  const declared = new Set();
  for (const k of plotArea.children) {
    if (k.name && k.name.startsWith(prefix) && AXIS_NAMES.has(local(k.name))) {
      const id = k.children.find((c) => c.name === `${prefix}axId`);
      if (id) declared.add(attr(id, "val"));
    }
  }
  if (!declared.size) return;
  for (const g of plotArea.children) {
    if (!g.name || !g.name.startsWith(prefix) || !GROUP_NAMES.has(local(g.name))) continue;
    const refs = g.children.filter((c) => c.name === `${prefix}axId`);
    const live = refs.filter((r) => declared.has(attr(r, "val")));
    if (live.length < 2 || live.length === refs.length) continue;
    g.children = g.children.filter((c) => !refs.includes(c) || live.includes(c));
    ctx.droppedAxIds += refs.length - live.length;
  }
}

function findAll(node, name, out = []) {
  if (node.name === name) out.push(node);
  for (const c of node.children || []) if (c.name) findAll(c, name, out);
  return out;
}

// Returns { xml, changed, moved, droppedAxIds, warnings } for one chart part.
function fixChartXml(xml) {
  const ctx = { moved: 0, droppedAxIds: 0, warnings: [] };
  const root = parse(tokenise(xml));
  const chartSpace = root.children.find((c) => c.name && local(c.name) === "chartSpace");
  const ns = chartSpace && chartSpace.open.match(new RegExp(`xmlns(?::([\\w.-]+))?="${C_NS}"`));
  if (!ns) return { xml, changed: false, ...ctx, warnings: ["no chart-namespace <chartSpace> root, left untouched"] };
  const prefix = ns[1] ? `${ns[1]}:` : "";
  walk(chartSpace, prefix, ctx);
  for (const pa of findAll(chartSpace, `${prefix}plotArea`)) dropDanglingAxIds(pa, prefix, ctx);
  const out = ctx.moved || ctx.droppedAxIds ? serialise(root) : xml;
  return { xml: out, changed: out !== xml, ...ctx };
}

// Apply to every chart part of a JSZip instance (the caller regenerates the archive).
async function fixChartSchemaOrder(zip) {
  const stats = { charts: 0, changedCharts: 0, reorderedElements: 0, droppedAxIds: 0, warnings: [] };
  for (const name of Object.keys(zip.files).filter((n) => /^ppt\/charts\/chart\d+\.xml$/.test(n))) {
    const r = fixChartXml(await zip.file(name).async("string"));
    stats.charts++;
    stats.reorderedElements += r.moved;
    stats.droppedAxIds += r.droppedAxIds;
    stats.warnings.push(...r.warnings.map((w) => `${name}: ${w}`));
    if (r.changed) { zip.file(name, r.xml); stats.changedCharts++; }
  }
  return stats;
}

module.exports = { fixChartSchemaOrder, fixChartXml };
