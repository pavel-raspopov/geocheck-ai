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

## Tesseract.js (v7.0.0 — verified 2026-09-13)

- Pure-JS OCR compiled to WASM. **API (verified against `node_modules/tesseract.js@7.0.0`):** `createWorker(langs = 'eng', oem = OEM.LSTM_ONLY, options)` → `worker.recognize(image, options, output)` → `worker.setParameters({...})` → `worker.terminate()`. The deprecated top-level `recognize()` creates a worker per call — never use it. (Older note claiming a `createTesseract` API was wrong.)
- **Image input:** `loadImage` accepts paths/URLs/dataURLs, HTML elements (IMG/CANVAS/VIDEO), OffscreenCanvas, File/Blob (browser) or **encoded** byte arrays (Node `Buffer`/`Uint8Array`). It does **NOT** accept raw pixel arrays (ImageData / `{data,width,height}`). The worker's `setImage` detects BMP by magic bytes `BM` and re-encodes it for Leptonica via bmp-js — so our pipeline encodes `RawImage` → 24bpp BMP in pure TS (`encodeBmp` in `ocr.ts`); a plain `Uint8Array` of BMP bytes works in both browser and Node.
- **Output:** default `recognize` output is `{ text: true }` **only** — request `{ blocks: true, text: false }` explicitly to get the JSON tree (`GetJSONText()`): `blocks[].paragraphs[].lines[].words[].symbols[]`, nodes with `text`, `confidence` (0–100), `bbox {x0,y0,x1,y1}`.
- **Char whitelist caveat:** LSTM engine (default) **ignores** `tessedit_char_whitelist` (it only affects the legacy engine) → the strict `[A-Z]` post-filter lives in our code (`extractLabels`); the parameter is still set harmlessly.
- **Local bundle (chosen over CDN, session 4):** `public/tessdata/eng.traineddata.gz` (`@tesseract.js-data/eng/4.0.0_best_int`, ~3 MB) + `public/tesseract/` (`worker.min.js` + the three LSTM-only core variants `tesseract-core-{lstm,simd-lstm,relaxedsimd-lstm}.{wasm,wasm.js}`; browser `getCore` loads `tesseract-core-<simd-cap>-lstm.wasm.js` from the `corePath` directory). `gzip: true` (default) matches the `.gz` file; gzip is detected by magic bytes.
  - **Browser:** `langPath: '/tessdata'`, `workerPath: '/tesseract/worker.min.js'`, `corePath: '/tesseract'`.
  - **Node/Vitest:** core + worker resolve locally from `node_modules` — do **NOT** set `workerPath`/`corePath` (breaks the node worker); only `langPath: 'public/tessdata'` (cwd-relative).
  - `cacheMethod: 'none'` disables cache read/write (deterministic, no stray `.traineddata` in cwd).
- **Parameters we set:** `tessedit_pageseg_mode: '11'` (PSM SPARSE_TEXT for scattered vertex labels), `tessedit_char_whitelist: 'A–Z'`, `user_defined_dpi: '96'`.
- **Gotcha:** raw pixel arrays are silently mis-processed if passed directly (worker treats bytes as encoded image) — always go through the BMP encoder.
- Unit-testable without a browser: pipeline stage is tested in Vitest (Node worker thread) with synthetic pixel-font letters; diagonal-free glyphs (E/H/L) are read reliably, blocky diagonals (A/B/M 5×7) get misread — keep test letters axis-aligned.

## oxlint / Prettier

- `pnpm lint` (oxlint, fast); `pnpm format` / `pnpm format:check` (Prettier). Both local — no CI server (GitHub only for final upload).

## Google Gemini REST API (planned — Phase 6, feature 10; verify before implementing)

> Status: **not yet wired** — notes below are from docs reading, not verified on this stack. Follow the rule: read official docs before implementation, then update this section with verified patterns.

- **Endpoint (browser `fetch`, no SDK needed):** `POST https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=<API_KEY>` (или header `x-goog-api-key`). Body: `{ contents: [{ parts: [{ text }] }], generationConfig: { responseMimeType: 'application/json', temperature: 0 } }`.
- **`responseMimeType: 'application/json'`** forces JSON output — pair with a strict prompt (ТЗ: «Выдели из текста геометрические сущности. Выведи ответ строго в формате JSON…»). Our Rule-JSON contract: `architecture.md` («Domain Types», `ParsedTask`) — extends the ТЗ example `{"points": [...], "relations": [...]}` with tagged relations (`angle/parallel/equal/on-segment/median/bisector/height`).
- **Fallback only:** client is called explicitly by the user (human-in-the-loop: парсер → просмотр правил → фолбэк при необходимости → подтверждение). API key comes from a UI input (optionally localStorage) — never from `.env`/repo (decision 2026-09-17; in a client-side bundle any build-time key would be public).
- **DI for tests:** `extractRulesGemini(text, apiKey, fetchLike?)` — inject `fetch` (or a wrapper) so Vitest covers parsing/validation with recorded responses; never hit the network in unit tests.
- **Soft failure:** network/4xx/invalid JSON → soft error `[Status: Error] Не удалось разобрать текст задачи` (failure model in `architecture.md`).
- Expect CORS: the REST endpoint is CORS-enabled for browser use (to verify live in Phase 6; if blocked, document the actual behavior).

## Puppeteer (dev-only QA, not shipped)

- Headless live-verification: `pnpm qa` → `scripts/qa/ui-shell.mjs` — serves `dist/` via `vite preview` (spawned from the script) and drives the **system Chrome** via `launch({ channel: 'chrome' })`.
- Chromium download is intentionally skipped: puppeteer's postinstall build script stays unapproved in pnpm (`allowBuilds` intentionally does NOT list puppeteer; `ERR_PNPM_IGNORED_BUILDS` on add is expected and harmless).
- Gotchas (inherited from cost-guard-ai QA): callbacks passed to `page.evaluate` / `page.waitForFunction` must be self-contained — closures over Node scope do not cross into the page; Chrome logs expected network noise (favicon 404) as console errors — filter explicitly in sweeps.
- For range inputs, set `.value` and dispatch `new Event('input', { bubbles: true })` — the app listens on `input`.
