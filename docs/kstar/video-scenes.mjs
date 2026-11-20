import { fieldGraphic, machineGraphic, plasmaOrbitGraphic, shadingCss } from "./geometry.mjs";
import { hMode, parts, peers, records, steps, summaries } from "./data.mjs";
import { readFileSync } from "node:fs";

const css = readFileSync(new URL("./style.css", import.meta.url), "utf8") + shadingCss();
const cards = {
  record: [[`${records.at(-2).seconds}초`, "1억 °C 이온온도 · 관측"], [`${hMode}초`, "고가둠 · 별도 기록"], [`${records.at(-1).seconds}초`, "1억 °C급 이온온도 · 목표"]],
  comparison: [
    ["KSTAR", "1억 °C급 제어 · 텅스텐 열 관리"],
    ...peers.slice(1).map(({ name, stat, metric }) => [`${name}  ·  ${stat}`, metric]),
  ],
  meaning: [["300초", "오래 유지한 고온 플라스마"], ["검증 대상", "가열 · 전류 구동 · 제어 · 열 배출"], ["별도 검증", "순이득 · 발전 · 반복 신뢰성"]],
};
const html = `<!doctype html><meta charset="utf-8"><style>${css}
body{background:#172620}.scene{width:760px;height:474px;display:grid;place-items:center;background:radial-gradient(ellipse at 50% 40%,#304638,#172620 74%);overflow:hidden}.field{width:690px}.field-track path{transition:none!important}
.summary-scene{color:#f3efe3;display:flex;flex-direction:column;justify-content:center;align-items:stretch;padding:35px 67px}.summary-scene h1{font-size:40px;margin-bottom:18px}.summary-row{padding:9px 0;border-top:1px solid #718477;display:grid;grid-template-columns:230px 1fr;align-items:center;font-size:23px}.summary-row strong{color:#ffcb98;letter-spacing:-.02em}
</style>
<div class="scene" id="machine" data-scene="vessel">${machineGraphic()}</div>
<div class="scene" id="orbit">${plasmaOrbitGraphic()}</div>
<div class="scene" id="field" data-step="helical">${fieldGraphic()}</div>
${summaries.map(({ id, short }) => `<div class="scene summary-scene" id="stage-${id}"><h1>${short}</h1>
  ${cards[id].map(([value, label]) => `<div class="summary-row"><strong>${value}</strong><span>${label}</span></div>`).join("")}</div>`).join("")}`;
process.stdout.write(JSON.stringify({
  html,
  machine: parts.map(({ id }) => id),
  field: steps.map(({ id }) => id),
  summaries: summaries.map(({ id }) => id),
}));
