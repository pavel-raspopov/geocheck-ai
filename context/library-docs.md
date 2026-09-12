# Library Docs — project-specific patterns

**Rule:** before using a third-party library, read its official current docs; these notes capture wiring verified on this stack. Keep them updated after Phase 2–5 work.

## Vite

- Vanilla TS layout: `index.html` at repo root, `/src/main.ts` entry, `public/` for static assets.
- `pnpm build` → `dist/`; `pnpm preview` serves it locally.
- If the final `dist/` is deployed from a subpath, set `base: './'` in `vite.config.ts`.

## Vitest

- Run: `pnpm test`. Config in `vitest.config.ts` (`include: src/**/*.spec.ts`).
- Pure TS stages need no environment; add `environment: 'jsdom'` only when UI/DOM tests appear (Phase 1+).

## OpenCV.js (`@techstark/opencv-js` 5.0.0 — verified 2026-09-12)

- WASM build of OpenCV, usable from browsers **and Node (Vitest)** — stage logic is unit-testable.
- **Loading (verified pattern, `src/pipeline/lines.ts`):**
  ```ts
  const mod = (await import('@techstark/opencv-js')) as unknown as {
    default: Promise<CvLike> | CvLike;
  };
  const cv = mod.default instanceof Promise ? await mod.default : mod.default;
  // then wait for runtime init: if (!cv.Mat) await onRuntimeInitialized (race-safe: also poll)
  ```
  UMD/CJS build: default-interop export IS the `cv` object. TypeScript types are namespace-only (`import type { CV } from "@techstark/opencv-js"`); the `default` value needs a cast.
- **Vitest gotcha (critical):** dynamic import of this UMD dep fails instantly with `TypeError: Method Promise.prototype.then called on incompatible receiver [object Module]` unless `test.server.deps.inline` lists it **and** `test.deps.interopDefault: false` — both under the `test` key of `vitest.config.ts` (root-level keys are silently ignored). Config in place.
- **Runtime init is async:** after import, `cv.Mat` may be undefined until WASM compiles (~5 s cold). `onRuntimeInitialized` may have fired before you attach it — pair the callback with polling (`cv.Mat` presence, see `waitRuntimeInitialized` in `lines.ts`).
- **Mat construction without canvas:** `cv.matFromArray(height, width, cv.CV_8UC4, rgbaArrayLike)` — flat interleaved RGBA, row-major (Uint8ClampedArray works; structurally ImageData).
- **Verified pipeline for line detection:** `cvtColor(rgba, gray, COLOR_RGBA2GRAY)` → **`Canny(gray, edges, 50, 150, 3, false)`** → `HoughLinesP(edges, lines, 1, π/180, threshold, minLineLength, maxLineGap)`.
  - **Canny is mandatory before Hough**: Hough treats every non-zero pixel as an edge point; on a black-lines-on-white drawing the white background floods the accumulator (symptom: only ±45° diagonals, hundreds of them).
  - `HoughLinesP` result Mat: `rows=1`, `cols=N`, type `CV_32SC4`; read `lines.data32S` in groups of 4 → `x1, y1, x2, y2`.
- Every `cv.Mat` must be `.delete()`ed (WASM heap) — use try/finally.
- Tuning constants live in `src/pipeline/constants.ts` (`CANNY_LOW/HIGH`, `HOUGH_THRESHOLD`, `HOUGH_MAX_GAP`); `minLineLength` = `MIN_SEGMENT_LENGTH` (ТЗ).

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
