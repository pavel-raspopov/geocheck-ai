# Progress Tracker

Update this file after every completed feature. Any agent reading this should immediately know what is done, what is in progress, and what is next.

---

## Current Status

**Phase:** Phase 4 — Verification Engine **завершена** (06 ✅)
**Last completed:** 06 verify.ts + result UI — проводка реального пайплайна в UI (2026-09-13; `src/pipeline/run.ts` `analyzeDrawing` (DI для OCR/CV, пустая детекция → мягкая ошибка); `src/ui/image-input.ts` File→RawImage; canvas contain-fit + оверлей сегментов/вершин/меток; verdict-card софт-ноты; «Проверить» = полный пайплайн, правило/ε — только verify() на сохранённом графе. Сопутствующие правки: `OCR_PSM` 11→6 (psm11 теряет одиночные метки у линий), `opencv-interop.ts` (UMD-обёртка ломала promise-разрешение). 67/67 юнит-тестов, live QA 12/12, гейты зелёные)
**Next / open point:** Phase 5 — 07 Performance & polish (бюджет ≤ 3 s на CPU, downscale, error/empty states, a11y, README)

## Progress

### Phase 0 — Initialization

- [x] 00 Project scaffold + AI harness (Vite+TS SPA; Vitest; design tokens; harness from cost-guard-ai; `pnpm test` / `typecheck` / `build` green)

### Phase 1 — UI Shell (mock data)

- [x] 01 Upload + rule selection + ε slider + verdict card (UI-компоненты в `src/ui/`; mock = `src/mock/demo-drawings.ts` + настоящий `verify()`; 16/16 юнит-тестов; гейты зелёные; живая проверка — headless QA 9/9 через `pnpm qa`)

### Phase 2 — CV Pipeline

- [x] 02 Line detection (OpenCV.js) (`src/pipeline/lines.ts`: grayscale → Canny → HoughLinesP → фильтр ≥ 30 px; 6 новых тестов на синтетике; Vitest: `test.server.deps.inline` + `deps.interopDefault: false`)
- [x] 03 Deduplication (`src/pipeline/dedup.ts`: Δугла ≤ 5° И расстояние ≤ 7 px — мин. расстояние отрезок↔отрезок; транзитивный union-find; слияние по двум дальним концам; 10 тестов на чистом TS, детерминированные)

### Phase 3 — OCR + Graph

- [x] 04 OCR (Tesseract.js) (`src/pipeline/ocr.ts`: `recognizeLabels` — RawImage → pure-TS BMP 24bpp (`encodeBmp`; v7 не принимает сырые пиксели) → воркер tesseract.js v7 (LSTM_ONLY, PSM 11, локальный bundle `public/tessdata/eng.traineddata.gz` + `public/tesseract/`, `cacheMethod:'none'`) → чистый пост-фильтр `extractLabels` (uppercase, [A-Z], conf ≥ 60, центр bbox); 9 тестов, интеграция на реальном WASM; LSTM игнорирует whitelist — фильтр в коде обязателен)
- [x] 05 Graph assembly (`buildGraph`: вершины = концы отрезков ∪ пересечения в допуске 2 px; кластеризация 5 px, центроид; привязка меток ≤ 40 px, дубликаты — min-дистанция; `unboundLabels` для софт-нот; 16 тестов + 3 интеграции с `verify`)

### Phase 4 — Verification Engine

- [x] 06 verify.ts + result UI (acceptance tests ТЗ §5) (`src/pipeline/run.ts`: `analyzeDrawing` — композиция стадий, DI для OCR/CV, пустая детекция → мягкая ошибка «отрезков не найдено»; acceptance ТЗ §5 — DI + e2e WASM (vitest) + live QA 12/12; `src/ui/image-input.ts` File→RawImage; canvas contain-fit + `CanvasOverlay` (сегменты/вершины/метки); verdict-card софт-ноты + плейсхолдер; «Проверить» = полный пайплайн, правило/ε после анализа — только verify() на сохранённом графе. Сопутствующие правки: `OCR_PSM` 11→6, `opencv-interop.ts` — UMD-обёртка opencv-js ломала promise-разрешение)

### Phase 5 — Hardening

- [ ] 07 Performance (≤ 3 s) & polish
