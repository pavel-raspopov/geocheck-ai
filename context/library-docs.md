# Library Docs — project-specific patterns

**Rule:** before using a third-party library, read its official current docs; these notes capture wiring verified on this stack. Keep them updated after Phase 2–5 work.

## Vite

- Vanilla TS layout: `index.html` at repo root, `/src/main.ts` entry, `public/` for static assets.
- `pnpm build` → `dist/`; `pnpm preview` serves it locally.
- If the final `dist/` is deployed from a subpath, set `base: './'` in `vite.config.ts`.

## Vitest

- Run: `pnpm test`. Config in `vitest.config.ts` (`include: src/**/*.spec.ts`).
- Pure TS stages need no environment; add `environment: 'jsdom'` only when UI/DOM tests appear (Phase 1+).

## OpenCV.js (`@techstark/opencv-js`)

- WASM build of OpenCV, usable from browsers and Node (so Vitest can run stage logic too).
- Pattern: **lazy load** — `const { cv } = await import('@techstark/opencv-js')` inside async stage functions (keeps the hot path light; large wasm is fetched once).
- Useful calls: `cv.imdecode` (ArrayBuffer → Mat), `cv.cvtColor` (BGR → GRAY), `cv.Canny`, and **`cv.HoughLinesP`** for segment detection (ТЗ stage 1; filter < 30 px).
  - Check the current package README for the exact WASM-loading incantation under Vite (may require serving `*.wasm` from `/public` or a `?url` import) — record it here after Phase 2 verification.

## Tesseract.js

- Pure-JS OCR compiled to WASM. New API: `createTesseract(options)` → `tesseract.recognize(image)` (check current docs; older `Tesseract` class is deprecated).
- For offline use, point `enginePath`/`tessdata` to a local copy (e.g. `public/tessdata/eng.traineddata`); decide local bundle vs CDN in Phase 4 (see memory open question).
- Post-filter OCR output to strict `[A-Z]` (uppercase, ТЗ §3.1); take the bounding box center as label coordinates.

## oxlint / Prettier

- `pnpm lint` (oxlint, fast); `pnpm format` / `pnpm format:check` (Prettier). Both local — no CI server (GitHub only for final upload).

## Puppeteer (dev-only QA, not shipped)

- Headless live-verification: `pnpm qa` → `scripts/qa/ui-shell.mjs` — serves `dist/` via `vite preview` (spawned from the script) and drives the **system Chrome** via `launch({ channel: 'chrome' })`.
- Chromium download is intentionally skipped: puppeteer's postinstall build script stays unapproved in pnpm (`allowBuilds` intentionally does NOT list puppeteer; `ERR_PNPM_IGNORED_BUILDS` on add is expected and harmless).
- Gotchas (inherited from cost-guard-ai QA): callbacks passed to `page.evaluate` / `page.waitForFunction` must be self-contained — closures over Node scope do not cross into the page; Chrome logs expected network noise (favicon 404) as console errors — filter explicitly in sweeps.
- For range inputs, set `.value` and dispatch `new Event('input', { bubbles: true })` — the app listens on `input`.
