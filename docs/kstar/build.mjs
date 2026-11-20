import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { parts, steps, records, peers, sources, hMode, summaries } from "./data.mjs";
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
const narration = JSON.parse(read("narration.json"));
const media = JSON.parse(read("media/manifest.json"));
const videos = Object.fromEntries([...parts, ...steps, ...summaries].map(({ id }) => {
  const clip = readFileSync(local(`media/${id}.mp4`));
  const digest = (value) => createHash("sha256").update(value).digest("hex");
  if (digest(narration[id]) !== media[id]?.narrationSha256 || digest(clip) !== media[id]?.videoSha256) {
    throw new Error(`Narration or video changed: regenerate ${id}`);
  }
  return [id, clip.toString("base64")];
}));
const observed = records.filter(({ goal }) => !goal);
const latest = observed.at(-1);
const goal = records.find(({ goal }) => goal);
const order = (i) => String(i + 1).padStart(2, "0");
const style = read("style.css") + shadingCss();
const script = read("live.js") + `\nsetupLessons(${JSON.stringify(videos)});\n`;

function description(chapter) {
  return `<h3>${encode(chapter.title)}</h3><p>${encode(chapter.info)}${ref(...chapter.refs)}</p>${chapter.note ? `<p>${encode(chapter.note)}</p>` : ""}
    <details class="transcript"><summary>음성 대본</summary><p>${encode(narration[chapter.id])}</p></details>`;
}

function lesson(id, figure, heading, chapters, poster) {
  return `<div class="lesson" data-lesson="${id}">
    <div class="lesson-grid js-only">
      <figure class="figure-plate">
        <div class="plate-head"><span class="plate-index">FIG. ${figure}</span><strong>${heading}</strong></div>
        <div class="video-stage">
          <div class="video-poster">${poster}</div>
          <button type="button" class="video-start">음성과 함께 재생</button>
          <video controls playsinline preload="none" aria-label="${heading} 영상" hidden></video>
        </div>
        <figcaption class="plate-foot"><span>설명용 애니메이션 · 한국어 음성</span><strong class="lesson-readout"></strong></figcaption>
      </figure>
      <div>
        <ol class="chapter-list" aria-label="${heading} 단계">${chapters.map((chapter, i) =>
    `<li><button type="button" data-chapter="${chapter.id}" aria-current="${i === 0 ? "step" : "false"}"><span aria-hidden="true">${order(i)}</span>${encode(chapter.short || chapter.title)}</button></li>`).join("")}</ol>
        <div class="lesson-controls" role="group" aria-label="영상 단계 이동 및 자동 넘김">
          <button type="button" class="lesson-prev" disabled>이전</button>
          <button type="button" class="lesson-next">다음</button>
          <button type="button" class="lesson-auto" aria-pressed="false">자동 넘김</button>
        </div>
        <p class="lesson-status" role="status">재생을 누르면 음성이 시작됩니다.</p>
        <div class="chapter-description">${description(chapters[0])}</div>
      </div>
    </div>
    <ol class="chapter-text">${chapters.map((chapter) => `<li>${description(chapter)}</li>`).join("")}</ol>
  </div>`;
}

const values = {
  SCRIPT_HASH: hash(script), STYLE_HASH: hash(style), STYLE: style, SCRIPT: script,
  MACHINE: machineGraphic(),
  MACHINE_LESSON: lesson("machine", "02", "장치 구조 영상", [...parts.slice(0, 4), parts[5], parts[4]], machineGraphic(true)),
  FIELD_LESSON: lesson("confinement", "03", "자기 가둠 영상", steps, `<div class="field-poster" data-step="helical">${fieldGraphic()}</div>`),
  SUMMARY_LESSON: lesson("summary", "04", "기록·비교·300초 목표 영상", summaries,
    `<div class="summary-poster"><span>48초 · 102초 · 300초</span><strong>같은 ‘초’, 서로 다른 뜻</strong></div>`),
  METRICS: `<dl class="lead-metrics" aria-label="KSTAR 운전 기록과 목표">
    <div><dt>이온온도 1억 °C · ${latest.year}</dt><dd>${latest.seconds}초</dd></div>
    <div><dt>별도 고가둠 기록 · ${latest.year}</dt><dd>${hMode}초</dd></div>
    <div class="target"><dt>이온온도 1억 °C급 · 목표</dt><dd>${goal.seconds}초</dd></div>
  </dl>`,
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
