# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Stack
Brief: plain static HTML/CSS/JS in one file (`docs/index.html`), no dependencies, served as GitHub Pages with relative URLs. Korean filenames must be percent-encoded in `href`.

## Users
ASSUMED (the brief had no answer mechanism): Korean learners and teachers who arrive at the published site and need to find and open one of the self-contained teaching pages in `docs/`. The pages themselves target Korean middle- and high-school students, per their own PRODUCT.md files.

## Product Purpose
`docs/index.html` is the catalog of every teaching page under `docs/**/*.html`. Success: a reader can tell in seconds what each page is (a truthful Korean name and one line), which subject it belongs to, and open it with one click or keypress.

## Positioning
A reference-book style table of contents for a small shelf of offline, interactive Korean teaching pages. It lists what exists and nothing it cannot back up.

## Operating Context
Mode: Read (a docs index, not a landing page). Opened on a laptop, a classroom projector or a phone. Hosted on GitHub Pages; each target is a standalone offline HTML file.

## Capabilities and Constraints
- Lists every `docs/**/*.html` except `template.html` and `index.html` itself.
- Category filter and search, both optional enhancements over a fully readable static list.
- Names and summaries come from each page's `<title>`, `<h1>`, `README.md` and `PRODUCT.md`; nothing is invented.
- Inventory is hand-maintained in the markup; there is no build step.

## Evidence on Hand
Four eligible files at time of writing: `anatomy/human-organs.html`, `auto-factory/auto-factory.html`, `shipyard/shipyard.html`, and `linear-function/일차함수_칠판강의.html`. No supplied logo, brand colors or screenshots.

## Product Principles
- Every page is findable and openable within seconds.
- Copy is Korean and only states what the page's own sources state.
- The list is the interface; filters help but are never required.

## Accessibility & Inclusion
Keyboard operable, visible focus, contrast ≥ 4.5:1, `prefers-reduced-motion` respected, readable on a 390 px phone without horizontal scrolling, works without JavaScript.
