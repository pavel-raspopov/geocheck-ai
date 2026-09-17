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

### 05 Graph assembly ✅

**Logic:** `graph.ts` — compute intersections of deduped segments → vertices; bind each label to the nearest vertex ≤ 40 px (else drop/soft-note). Tests with the acceptance shapes. **Done 2026-09-13** (`buildGraph`: кандидаты = концы отрезков ∪ пересечения в допуске 2 px; жадная кластеризация по 5 px, центроид; привязка ≤ `LABEL_RADIUS`, дубликаты букв — min-дистанция; вывод `GraphResult { graph, vertices, unboundLabels }`; 16 тестов + 3 интеграции с `verify`; утверждённая интерпретация: концы отрезков тоже вершины — иначе parallel/equal-segments не привязывают A/B/C/D).

---

## Phase 4 — Verification Engine

### 06 verify.ts + result UI ✅

**Logic:** 4 rules with ε (verify.ts already scaffolded in Phase 0); soft errors; exact ТЗ messages; acceptance tests (ТЗ §5): right triangle → `Success`; 84.12° at ε=3 → `Fail` with exact text; M beyond B → `Fail`.
**UI:** wire the real pipeline to the verdict card; overlay recognized lines/labels/vertices on the canvas.
**Done 2026-09-13** (`src/pipeline/run.ts`: `analyzeDrawing` — композиция стадий, DI для OCR/CV, пустая детекция → мягкая ошибка; `src/ui/image-input.ts` File→RawImage; canvas contain-fit + `CanvasOverlay`; verdict-card софт-ноты; проводка в app.ts — «Проверить» запускает полный пайплайн, смена правила/ε пересчитывает только verify() на сохранённом графе. acceptance ТЗ §5 — DI-тесты + e2e WASM (vitest) + live QA 12/12 (`pnpm qa`). Сопутствующие правки: `OCR_PSM` 11→6 (psm11 теряет одиночные метки у линий), `opencv-interop.ts` — разворачивание UMD-обёртки (TypeError incompatible receiver).

---

## Phase 5 — Hardening

### 07 Performance & polish

**Logic/UI:** measure and hold ≤ 3 s per image on CPU (downscale strategy); error/empty states; a11y pass; README final; final commit (then optional GitHub upload).
**Done 2026-09-13** (даунскейл до `MAX_IMAGE_DIMENSION` 1600 + замер стадий `StageTimings` в `run.ts`, строка времени `.verdict-timing` в verdict-card, декод с превью одного размера в `image-input.ts` (`imageSmoothingQuality: high`), битое изображение → мягкая ошибка чтения, a11y: canvas `role="img"` + aria-label, QA 16/16).

---

# Phase 6 — Task-text rules + multi-rule verification (v2, ТЗ ред. 2026-09-17)

**Изменение требований:** вход = изображение + текст задачи; правила извлекаются из текста (оффлайн-парсер основной, Gemini фолбэк), пользователь подтверждает правила, верифицируются **все** подтверждённые правила. Dropdown правил удаляется. `testdata/` — acceptance-корпус.

### 08 Rule domain + оффлайн-парсер (`src/pipeline/rules/`)

**Logic:** `parseTask(text)` — чистая функция, TDD: нормализация омоглифов (А→A, В→B, С→C, К→K, М→M, Н→H, Е→E, О→O, Р→P, Т→T, Х→X; `<` → `∠`) → словарный разбор → `ParsedTask { points, relations, givens, source }` (типы — `architecture.md`). Сценарии: медиана, биссектриса, высота, градусная мера, параллельность, равенство, принадлежность, перпендикуляр. Длины («16 см») → `givens` без верификации. Тесты: обе testdata-задачи (`testdata/1-text.txt`, `testdata/2-text.txt`) обязаны парситься. **Done 2026-09-17** (`parseTask` → `ParseResult` ok/мягкая ошибка; чевианы в обеих формах записи («медиана BK» / «BK-медиана»); угловые меры вырезаются из текста перед equal/length-паттернами; единица длины обязательна; 25 новых тестов, 101/101).

### 09 Rule engine v2 (multi-rule verify)

**Logic:** `rules-engine.ts` — оценка списка `Relation[]` по графу; новые проверки: `angle` (произвольная мера N°, |∠−N| ≤ ε), `median` (on-segment + equal), `bisector` (|∠ABM − ∠MBC| ≤ ε), `height` (⊥ + on-line); базовые 4 переиспользуются. Агрегация: Success ⇔ все Success; Error доминирует над Fail; сообщения RU. **Имя угла в сообщении угла — решение пользователя 2026-09-17** (отход от формулировки ТЗ: `Ошибка: Угол ABC на рисунке равен 84.12°, отклонение составляет 5.88°`). Мягкие ошибки сохраняются.
**Done 2026-09-17** (`evaluateRules` → `{ results: RuleOutcome[], verdict }`; составные правила = один результат на relation, сообщение от провалившейся под-проверки; пустой relations (givens-only) → Success; геометрические хелперы verify.ts вынесены в `geometry.ts` (`dist/resolveAll/cornerAngleDeg/lineAngleDeg/pointLineDistance`), v1-функции не изменены; 19 новых тестов, 120/120).

### 10 Gemini fallback-клиент

**Logic:** `extractRulesGemini(text, apiKey, deps?)` — REST `generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent`, strict prompt → Rule-JSON (`responseMimeType: application/json`), валидация, DI-мок для тестов. Невалидный ответ → мягкая ошибка. Вызывается ТОЛЬКО по явному действию пользователя (после просмотра результата парсера). API key — только из UI-поля; не в git, не в `.env`.
**Done 2026-09-17** (`src/pipeline/rules/gemini.ts` + spec: auth header `x-goog-api-key`, DI через минимальный структурный `FetchLike`; `validateRuleJson` — A–Z после trim+uppercase, per-kind проверки, points sort+dedup; мягкая ошибка `GEMINI_SOFT_ERROR` на network/не-2xx/битый JSON/нарушенный контракт; markdown-фенсы срезаются defensive; 10 тестов, 130/130. Живой CORS-чек перенесён в фичу 11 — нужен реальный ключ в браузере).

### 11 UI v2 (mock-first): текст задачи + предпросмотр правил + подтверждение

**UI:** поле текста задачи (textarea) вместо `rule-select`; область «Распознанные правила» (человекочитаемый список + «дано»); кнопка «Подтвердить и проверить» (human-in-the-loop шлюз); скрытая секция фолбэка с полем API key + кнопкой «Уточнить через ИИ»; verdict-чеклист (по правилу на строку + общий итог). Мок-данные правил → визуальная проверка → проводка.
**Done 2026-09-17** (`src/ui/task-text.ts`, `rules-preview.ts`, `gemini-fallback.ts` (localStorage `geocheck.gemini-api-key`), `verdict-checklist.ts`, `relation-format.ts` (+9 тестов); `run.ts`: `analyzeImage()` без single-rule verify (+2 теста, `analyzeDrawing` делегирует); `demo-drawings.ts`: `DEMO_TASK_TEXT` (+2 теста — парсится в 4 правила, идеал Success/наклон Fail); `app.ts` v2: парсер на input → подтверждение → `evaluateRules`, ε-пересчёт на сохранённом графе, анализ переживает правку текста (без повторного OCR), пустая детекция → софт-ошибка «не найдено отрезков»; `rule-select.ts` удалён; QA ui-shell.mjs переписан на text→confirm флоу — 19/19, юниты 143/143, гейты зелёные. Живой CORS-чек — проба `scripts/qa/gemini-cors-probe.mjs` (из песочницы ответ не получен; нужна реальная сеть+ключ пользователя).

### 12 testdata-харнесс (`scripts/qa/testdata.mjs`)

**Logic:** puppeteer-прогон связок `testdata/N-text.txt` × `testdata/N-photo*-true|false.jpg` через собранный `dist/`; сверка вердикта с суффиксом имени файла. Цель: 4/4 связки зелёные (2 задачи: 1 true + 2 false; 2: 1 true). Калибровка порогов/промпта при необходимости.

### 13 Live QA + доки

`pnpm qa` дополнить шагами нового флоу; README («Как это работает: текст → правила → проверка»); финальный коммит фазы.

---

## Phase Checklist (mirrors progress-tracker)

- [x] 00 Project scaffold + AI harness
- [x] 01 Upload + rule selection + ε slider
- [x] 02 Line detection (OpenCV.js)
- [x] 03 Deduplication
- [x] 04 OCR (Tesseract.js) (Done 2026-09-13)
- [x] 05 Graph assembly (Done 2026-09-13)
- [x] 06 verify.ts + result UI (Done 2026-09-13)
- [x] 07 Performance & polish (Done 2026-09-13)
- [x] 08 Rule domain + оффлайн-парсер (Phase 6) (Done 2026-09-17)
- [x] 09 Rule engine v2 (Phase 6) (Done 2026-09-17)
- [x] 10 Gemini fallback-клиент (Phase 6) (Done 2026-09-17)
- [x] 11 UI v2: текст задачи + правила + подтверждение (Phase 6) (Done 2026-09-17)
- [ ] 12 testdata-харнесс (Phase 6)
- [ ] 13 Live QA + доки (Phase 6)
