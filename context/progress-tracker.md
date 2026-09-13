# Progress Tracker

Update this file after every completed feature. Any agent reading this should immediately know what is done, what is in progress, and what is next.

---

## Current Status

**Phase:** Phase 3 — OCR + Graph **завершена** (04 ✅, 05 ✅)
**Last completed:** 05 Graph assembly — `src/pipeline/graph.ts` (2026-09-13; `buildGraph(segments, labels): GraphResult` — кандидаты = концы отрезков ∪ пересечения в допуске `ON_SEGMENT_TOLERANCE`=2 px; жадная кластеризация по `VERTEX_MERGE_RADIUS`=5 px, центроид; привязка меток ≤ `LABEL_RADIUS`=40 px, дубликаты букв — min-дистанция; `unboundLabels` — софт-ноты для UI; 16 тестов + 3 интеграции с `verify`, гейты зелёные; утверждённая интерпретация: концы отрезков тоже вершины — иначе parallel/equal-segments не привязывают A/B/C/D)
**Next / open point:** Phase 4 — 06 verify.ts + result UI (проводка реального пайплайна lines→dedup→ocr→graph→verify в UI + acceptance-тесты ТЗ §5)

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

- [ ] 06 verify.ts + result UI (acceptance tests ТЗ §5)

### Phase 5 — Hardening

- [ ] 07 Performance (≤ 3 s) & polish
