# Copilot Instructions — Document Generation Defaults

These instructions apply to GitHub Copilot (and the Copilot CLI) whenever a
document is requested in this repository.

## 1. Default format and language

- If the user does not explicitly direct a different format or language,
  **create the document as a Korean-language PowerPoint (`.pptx`) file**.
- Use the `pptx` skill to build/edit the file. Do not default to Word,
  Markdown, or English unless the user asks for it.
- Use `frontend-design` and `impeccable` skill to design the document.

## 2. Required slides and image generation

Use the `mai-image-2-6-flash` skill for every generated image in the deck.
Build the deck with these mandatory slides/sections:

- **Front cover page**: title slide with a **full-bleed background image
  covering the entire slide (edge to edge, 100% of the slide width and
  height), not a half-size or side panel**. Generate it with
  `mai-image-2-6-flash`. Overlay the title text on it, and add a
  semi-transparent dark gradient behind the text if needed for legibility.
- **Ending page**: closing slide containing a "Thank you" message (in
  Korean, e.g. "감사합니다"), with the same **full-bleed, full-size
  background image** (not a half-size or side panel) generated with
  `mai-image-2-6-flash`, and the same text-legibility overlay.
- **Every content slide** (i.e., all slides except the cover and ending
  pages):
  - Place the slide's text content on the **left side** of the slide.
  - Generate a supporting image with `mai-image-2-6-flash` that visually
    represents the flow, process, or architecture described by that
    slide's text (a diagram that summarizes and matches the left-side
    content), and place it on the right side of the slide.
    If label is required in the images, the image should have blank box,
    the actual word should be from pptx textbox.

### Image style requirements

- Images must be **infographic-style**: clean, modern, and visually
  engaging ("fancy").
- Do **not** generate ambiguous or purely conceptual/abstract art — every
  image must clearly and literally depict the flow/process/architecture it
  is meant to summarize, so a viewer can understand the diagram without
  reading the slide text.
- Full-size cover and ending background images are the exception: generate
  them in landscape 16:9 (2048x1152, the model's maximum), keep the text
  area calm/dark, and place them at 0,0 covering the whole slide.
- Generate the content-slide images in portrait orientation first (per prior project
  experience, 768x1344 via MAI-Image-2.6-Flash), then center-crop with PIL
  to the exact panel size before inserting — `pptxgenjs`'s built-in `cover`
  sizing is unreliable for precise placement.
- Image generation calls are throttled and may take ~15s each and hit
  `429`; follow the `mai-image-2-6-flash` skill's retry/backoff guidance
  and generate images sequentially, skipping any already-generated files so
  the run is resumable.

## 2a. Typography (font sizes)

Apply these sizes on every content slide (cover and ending pages may use a
larger display size for the deck title):

| Element | Size |
|---|---|
| Headline: the main title of each slide | **24–32 pt** |
| Title: sub-headings, card/section titles within a slide | **16–18 pt** |
| Main body text (bullets, descriptions, table cells) | **12–14 pt** |

- Keep one size per level within a deck so slides look consistent.
- Do not go below 12 pt for body text; if content does not fit, shorten the
  text or split the slide instead of shrinking the font.
- Footer, page number and source credits are exempt (small captions).
- For text boxes, inforce line spacing: Multiple, At: 1.2
- Set the Hanging Indent and Left Indent one step to the right of the First Line Indent,
  for text boxes contains bullet points.

## 3. Document ownership

- Unless told otherwise, all documents are prepared by **"Microsoft Korea
  STU"**. Include this as the author/preparer wherever the deck shows an
  author, footer credit, or "prepared by" line (e.g., on the cover page).

## 4. Microsoft logo placement

- On **every slide except the cover page and the ending page**, place a
  small Microsoft logo in the **top-right corner** of the slide.
- "Microsoft logo" means the four-color Microsoft logo mark **plus** the
  "MICROSOFT" wordmark next to it — not the mark alone.
- Keep the logo small and unobtrusive so it does not overlap or compete
  with the slide's text or generated image.

## 5. General build notes (from prior project experience)

- Render the deck via `soffice` → `pdftoppm` to visually check output;
  `pptxgenjs` text/table fonts often look smaller than intended at
  8–10pt on a 13.33in slide — scale fonts up until content fills roughly
  70% of slide height without touching the footer/logo area.
- A `validate.py` warning about `notesMasterIdLst` ordering on
  `pptxgenjs` output is a known generator quirk, not a content bug, and can
  be ignored.

## 6. Long-running background jobs
- While any background job runs for more than ~10 minutes (image generation,
  long builds, multi-agent fleets), post a short status report every 10
  minutes (use `manage_schedule` with `interval: "10m"`): progress count and
  failures, whether the process is alive, a one-line CPU/memory/disk check,
  ETA, and any pending user input. Keep it under ~60 words and stop the
  schedule when the job is finished.

## 7. Skills: single source of truth

- `~/.agents/skills/` is the **single source of truth** for every skill.
  Create and edit skills there, never inside this repository.
- `.github/skills/<name>` must be a **symlink** to `~/.agents/skills/<name>`
  (`ln -s ~/.agents/skills/<name> .github/skills/<name>`), never a copied
  directory, so the repo and the global environment cannot drift apart.
- To make a skill available here, add a symlink. If a skill exists only
  outside `~/.agents/skills/`, first move or copy it into
  `~/.agents/skills/`, then link it.
- Do not edit files through the symlink expecting repo-local changes: edits
  land in `~/.agents/skills/` and affect every repository.
- The links are absolute and resolve only on a machine that has
  `~/.agents/skills/`; a fresh clone must recreate them.
