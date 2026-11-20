import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { parts, steps, records, peers, sources, hMode } from "./data.mjs";
import { auditGeometry, fieldGraphic, machineGraphic, shadingCss } from "./geometry.mjs";

const argv = new Set(process.argv.slice(2));
for (const flag of argv) {
  if (!["--audit", "--check"].includes(flag)) throw new Error(`Unknown option: ${flag}`);
}
if (argv.has("--audit")) auditGeometry();

const local = (name) => new URL(name, import.meta.url);
const read = (name) => readFileSync(local(name), "utf8");
const encode = (value) => String(value).replace(/[&<>"']/g, (c) =>
  ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const hash = (value) => `sha256-${createHash("sha256").update(value).digest("base64")}`;
const sourceIds = Object.keys(sources);
const ref = (...ids) => ids.map((id) => {
  if (!(id in sources)) throw new Error(`Unknown source: ${id}`);
  const i = sourceIds.indexOf(id) + 1;
  return `<a class="ref" href="#source-${id}" aria-label="출처 ${i}">[${i}]</a>`;
}).join("");
const componentText = (part) => `<p class="technical" lang="en">${encode(part.technical)}</p><p>${encode(part.info)}${ref(...part.refs)}</p>`;
const stepText = (step) => `<h3>${encode(step.title)}</h3><p>${encode(step.info)}${ref(...step.refs)}</p><p>${encode(step.note)}</p>`;
const observed = records.filter(({ goal }) => !goal);
const latest = observed.at(-1);
const goal = records.find(({ goal }) => goal);
const order = (i) => String(i + 1).padStart(2, "0");
const style = read("style.css") + shadingCss();
const script = read("live.js");

const values = {
  SCRIPT_HASH: hash(script), STYLE_HASH: hash(style), STYLE: style, SCRIPT: script,
  MACHINE: machineGraphic(), INSPECTOR: machineGraphic(true), FIELD: fieldGraphic(),
  METRICS: `<dl class="lead-metrics" aria-label="KSTAR 운전 기록과 목표">
    <div><dt>이온온도 1억 °C · ${latest.year}</dt><dd>${latest.seconds}초</dd></div>
    <div><dt>별도 고가둠 기록 · ${latest.year}</dt><dd>${hMode}초</dd></div>
    <div class="target"><dt>이온온도 1억 °C급 · 목표</dt><dd>${goal.seconds}초</dd></div>
  </dl>`,
  PART_CONTROLS: parts.map((part, i) => `<button class="component" type="button" data-part="${part.id}" aria-pressed="${i === 0}">
    <span aria-hidden="true">${order(i)}</span><span>${encode(part.title)}</span></button>`).join(""),
  FIRST_PART: componentText(parts[0]),
  PART_DETAILS: parts.map((part) => `<div><dt>${encode(part.title)}</dt><dd>${componentText(part)}</dd></div>`).join(""),
  STEP_CONTROLS: steps.map((step, i) => `<li><button type="button" data-step="${step.id}" aria-pressed="${i === 0}"><span aria-hidden="true">${order(i)} </span>${encode(step.short)}</button></li>`).join(""),
  FIRST_STEP: stepText(steps[0]),
  STEP_DETAILS: steps.map((step) => `<li data-readout="${encode(step.track)}">${stepText(step)}</li>`).join(""),
  RECORDS: `<dl class="record-plot" aria-label="이온온도 1억도 운전 추이">${records.map((record) =>
    `<div${record.goal ? ' class="target"' : ""}><dt>${record.year}</dt><dd><meter aria-hidden="true" min="0" max="${goal.seconds}" value="${record.seconds}"></meter></dd><dd class="time">${record.seconds}초</dd></div>`
  ).join("")}</dl>`,
  PEERS: peers.map((peer) => `<article class="peer"><h3>${encode(peer.name)}<small>${encode(peer.site)}</small></h3>
    <div><strong class="peer-stat">${encode(peer.stat)}</strong><span class="peer-type">${encode(peer.metric)}</span></div>
    <p>${encode(peer.note)}${ref(...peer.refs)}</p></article>`).join(""),
  SOURCES: sourceIds.map((id) => {
    const [title, detail, url] = sources[id];
    if (new URL(url).protocol !== "https:") throw new Error(`Invalid source URL: ${url}`);
    return `<li id="source-${id}"><a href="${encode(url)}">${encode(title)}</a><span>${encode(detail)}</span></li>`;
  }).join(""),
  REF_MACHINE: ref("magnets", "tokamak"),
  REF_DEVICE: ref("magnets", "results"),
  REF_DIFFERENCE: ref("record", "nature", "east"),
  REF_RECORD: ref("results", "record"),
  REF_UPGRADE: ref("record", "tungsten", "overview"),
  REF_MEANING: ref("record", "overview", "iter", "east"),
};
const html = read("template.html").replace(/\{\{([A-Z_]+)\}\}/g, (_, key) => {
  if (!(key in values)) throw new Error(`Unknown template slot: ${key}`);
  return values[key];
});
const output = local("kstar.html");
if (argv.has("--check")) {
  if (read("kstar.html") !== html) throw new Error("Run node docs/kstar/build.mjs to refresh kstar.html");
  console.log("Generated HTML matches the on-disk artifact.");
} else {
  writeFileSync(output, html);
  console.log(`Built ${output.pathname} (${Buffer.byteLength(html).toLocaleString("en")} bytes).`);
}
