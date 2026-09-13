# Build Plan

## Core Principle

**Visible before logic.** Every surface is built with mock data first and verified visually; functionality is wired step by step. No invisible backend-only phases (there is no backend).

Mirrors `context/project-brief.md`. Update `progress-tracker.md` after each item.

---

## Phase 0 — Initialization ✅

### 00 Project scaffold + AI harness

**Logic:** Vite + TS SPA skeleton, Vitest wired, design tokens, AI harness adapted from cost-guard-ai (skills, context/*, AGENTS.md, .clinerules), git init + initial commit. **Done 2026-09-12.**

---

## Phase 1 — UI Shell (mock data)

### 01 Upload + rule selection + ε slider

**UI:** drag-and-drop zone + file input; rule dropdown (4 rules with Russian labels); ε slider (0.5–10, step 0.5, default 3.0); canvas with checkerboard + mock drawing overlay; verdict card (aria-live). Mock pipeline result for visual verification first.

---

## Phase 2 — CV Pipeline

### 02 Line detection (OpenCV.js) ✅

**Logic:** `lines.ts` — load image (data URL / ImageData), grayscale, `HoughLinesP`; filter segments < 30 px; return `LineSegment[]`. Tests with small synthetic drawings. **Done 2026-09-12** (grayscale → Canny → HoughLinesP; Vitest требует `test.server.deps.inline` + `test.deps.interopDefault: false`).

### 03 Deduplication ✅

**Logic:** `dedup.ts` — cluster segments (angle diff ≤ 5° AND euclidean distance ≤ 7 px), merge each cluster into one segment spanning its two farthest endpoints. Deterministic unit tests. **Done 2026-09-13** (`deduplicateSegments`: чистая sync-функция; «расстояние» = мин. расстояние отрезок↔отрезок (4 пары конец→отрезок), углы без направления [0°, 180°), транзитивный union-find, вывод — длина ↓, ids `seg-N`).

---

## Phase 3 — OCR + Graph

### 04 OCR (Tesseract.js) ✅

**Logic:** `ocr.ts` — recognize single Latin letters A–Z (uppercase filter), return center coordinates; decide local `tessdata` bundling vs CDN (see library-docs / memory open question). **Done 2026-09-13** (`recognizeLabels`: RawImage → pure-TS BMP 24bpp → tesseract.js v7 worker (LSTM, PSM 11, локальный bundle `public/tessdata`+`public/tesseract`, `cacheMethod:'none'`) → чистый пост-фильтр `extractLabels` (uppercase, [A-Z], conf ≥ 60, центр bbox); 9 тестов, интеграция на реальном WASM; oem LSTM игнорирует whitelist — фильтр обязателен).

### 05 Graph assembly

**Logic:** `graph.ts` — compute intersections of deduped segments → vertices; bind each label to the nearest vertex ≤ 40 px (else drop/soft-note). Tests with the acceptance shapes.

---

## Phase 4 — Verification Engine

### 06 verify.ts + result UI

**Logic:** 4 rules with ε (verify.ts already scaffolded in Phase 0); soft errors; exact ТЗ messages; acceptance tests (ТЗ §5): right triangle → `Success`; 84.12° at ε=3 → `Fail` with exact text; M beyond B → `Fail`.
**UI:** wire the real pipeline to the verdict card; overlay recognized lines/labels/vertices on the canvas.

---

## Phase 5 — Hardening

### 07 Performance & polish

**Logic/UI:** measure and hold ≤ 3 s per image on CPU (downscale strategy); error/empty states; a11y pass; README final; final commit (then optional GitHub upload).

---

## Phase Checklist (mirrors progress-tracker)

- [x] 00 Project scaffold + AI harness
- [x] 01 Upload + rule selection + ε slider
- [x] 02 Line detection (OpenCV.js)
- [x] 03 Deduplication
- [x] 04 OCR (Tesseract.js) (Done 2026-09-13)
- [ ] 05 Graph assembly
- [ ] 06 verify.ts + result UI
- [ ] 07 Performance & polish
