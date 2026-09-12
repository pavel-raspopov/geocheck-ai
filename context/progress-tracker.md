# Progress Tracker

Update this file after every completed feature. Any agent reading this should immediately know what is done, what is in progress, and what is next.

---

## Current Status

**Phase:** Phase 2 — CV Pipeline **в работе** (02 ✅, 03 — следующая)
**Last completed:** 02 Line detection (OpenCV.js) — `src/pipeline/lines.ts` (2026-09-12; grayscale → Canny → HoughLinesP; 22/22 юнит-тестов, гейты зелёные)
**Next / open point:** Phase 2 — 03 Deduplication

## Progress

### Phase 0 — Initialization

- [x] 00 Project scaffold + AI harness (Vite+TS SPA; Vitest; design tokens; harness from cost-guard-ai; `pnpm test` / `typecheck` / `build` green)

### Phase 1 — UI Shell (mock data)

- [x] 01 Upload + rule selection + ε slider + verdict card (UI-компоненты в `src/ui/`; mock = `src/mock/demo-drawings.ts` + настоящий `verify()`; 16/16 юнит-тестов; гейты зелёные; живая проверка — headless QA 9/9 через `pnpm qa`)

### Phase 2 — CV Pipeline

- [x] 02 Line detection (OpenCV.js) (`src/pipeline/lines.ts`: grayscale → Canny → HoughLinesP → фильтр ≥ 30 px; 6 новых тестов на синтетике; Vitest: `test.server.deps.inline` + `deps.interopDefault: false`)
- [ ] 03 Deduplication

### Phase 3 — OCR + Graph

- [ ] 04 OCR (Tesseract.js)
- [ ] 05 Graph assembly

### Phase 4 — Verification Engine

- [ ] 06 verify.ts + result UI (acceptance tests ТЗ §5)

### Phase 5 — Hardening

- [ ] 07 Performance (≤ 3 s) & polish
