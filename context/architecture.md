# Architecture

## Stack (locked)

| Layer    | Tool                                     | Purpose                                   |
| -------- | ---------------------------------------- | ----------------------------------------- |
| App      | Vite + TypeScript (vanilla SPA)          | Single page, no framework                 |
| Styling  | Vanilla CSS custom properties (tokens)   | Design tokens from `ui-tokens.md`         |
| CV       | OpenCV.js (`@techstark/opencv-js`, WASM) | Segment detection (HoughLinesP)           |
| OCR      | Tesseract.js (WASM)                      | Single Latin letters A–Z + centers        |
| Tests    | Vitest 4                                 | TDD on `src/pipeline/*`                   |
| Quality  | TS strict · oxlint · Prettier            | Local gates (scripted in package.json)    |
| Delivery | `pnpm build` → static `dist/`            | Browser-only; no server, no DB, no Docker |

## Folder Structure

```
geometry/
├── AGENTS.md / .clinerules / PRODUCT.md / DESIGN.md   # agent + product rules
├── product-brief.md                                   # исходное ТЗ (рус., единый источник правды)
├── context/                                           # авторитетные доки (см. порядок чтения в AGENTS.md)
├── src/
│   ├── main.ts                                        # bootstrap SPA
│   ├── styles.css                                     # дизайн-токены (CSS custom properties)
│   ├── ui/                                            # компоненты интерфейса (Phase 1+)
│   └── pipeline/                                      # чистые функции пайплайна (TDD)
│       ├── types.ts / constants.ts                    # доменные типы и пороги из ТЗ
│       ├── lines.ts  (детекция отрезков ≥ 30 px)
│       ├── dedup.ts  (кластеризация 5°/7 px + слияние)
│       ├── ocr.ts    (буквы A–Z + центры)
│       ├── graph.ts  (пересечения, привязка ≤ 40 px)
│       └── verify.ts (4 правила, ε)
├── public/                                           # статика (tessdata при необходимости)
├── docs/superpowers/plans/                           # датированные планы фич
└── .agents/skills/ · .claude/skills/                 # vendored skills
```

## Pipeline (ТЗ §2)

1. **lines** — bitmap → grayscale → Canny → detect segments (any orientation, min 30 px).
2. **dedup** — cluster segments: angle diff ≤ 5° AND distance ≤ 7 px → merge to the two farthest endpoints. Approved interpretation: angle is direction-independent ([0°, 180°), diff = min(|a−b|, 180−|a−b|)); «distance» = minimum segment-to-segment distance (min over 4 endpoint→segment distances; 0 for overlapping collinear fragments); clustering is transitive (union-find); output deterministic (length ↓, ids `seg-N`). Implemented in `src/pipeline/dedup.ts` (`deduplicateSegments`, pure sync).
3. **ocr** — single Latin letters A–Z (uppercase), center coordinates. Implemented in `src/pipeline/ocr.ts` (`recognizeLabels`, async): `RawImage` → pure-TS BMP encoder (v7 `loadImage` accepts no raw pixels; worker detects BMP magic and re-encodes for Leptonica) → tesseract.js worker (module-cached, LSTM_ONLY, PSM 6 uniform block, local bundle `public/tessdata` + `public/tesseract`, `cacheMethod:'none'`) → pure post-filter `extractLabels` (LSTM ignores `tessedit_char_whitelist`): uppercase, strict `[A-Z]`, confidence ≥ 60, bbox center, deterministic order (cy ↑, cx ↑). Approved interpretation (Фаза 4): **PSM 6, not 11** — sparse mode (11) silently drops isolated labels near segments; uniform-block mode (6) reads them. Empirical companion rule: labels OCR reliably when they are darker than the drawing lines (Otsu drops light-gray lines from OCR's view; Canny still detects them — gradient ≈ 79 > CANNY_LOW).
4. **graph** — vertices from deduped segments; bind each letter → nearest vertex ≤ 40 px (else drop into `unboundLabels`, soft-note in UI). Implemented in `src/pipeline/graph.ts` (`buildGraph`, pure sync): candidates = segment endpoints **∪** pairwise intersections lying (within `ON_SEGMENT_TOLERANCE` px, Hough noise) on both segments; greedy clustering by `VERTEX_MERGE_RADIUS` (deterministic: sort cy ↑ / cx ↑, cluster centroid); duplicate letters — closest binding wins. Approved interpretation: **segment endpoints count as vertices** — otherwise two separately drawn parallel segments yield no intersections and `parallel`/`equal-segments` could never bind A/B/C/D; extra unlabeled vertices (e.g. tick-mark ends) are harmless since labels define the graph.
5. **verify (v2 — multi-rule)** — проверка **всех** подтверждённых правил с ε (default 3.0); сценарии: `angle` (градусная мера, обобщает perpendicular), `parallel`, `equal`, `on-segment`, `median` (= on-segment середины + equal половин), `bisector` (|∠ABM − ∠MBC| ≤ ε), `height` (⊥ + точка на прямой). Возвращает **список** результатов (по одному на правило) + агрегированный вердикт.
6. **wiring** — `src/pipeline/run.ts` (`analyzeDrawing(image, rule, epsilon, deps?)`, async, no DOM): lines → dedup → ocr → graph → verify; returns `PipelineResult { segments, labels, vertices, graph, unboundLabels, verdict }` for the UI (verdict + overlay + soft-notes). Empty detection → soft error `[Status: Error] На чертеже не найдено отрезков`. OCR/CV stages are injectable via `PipelineDeps` (deterministic DI tests). Interop note: `@techstark/opencv-js` is UMD/CJS whose default export is a Promise — the bundler's `__toESM` wrapper inherits `Promise.prototype` and looks like a thenable, which breaks promise resolution (`TypeError: … incompatible receiver`); `src/pipeline/opencv-interop.ts` unwraps it at module level. UI rule: rule/ε changes after an analysis re-run only `verify()` on the stored graph — CV/OCR never re-runs implicitly.
7. **text → rules (НОВАЯ стадия, Phase 6)** — `src/pipeline/rules/`:
   - **Основной путь:** оффлайн-парсер (`parseTask(text)` — чистая функция, TDD): нормализация кириллических омоглифов (А→A, В→B, С→C, К→K, М→M, Н→H, Е→E, О→O, Р→P, Т→T, Х→X; `<` → `∠`) → словарный разбор («медиана», «биссектриса», «высота», «перпендикуляр», «середина», «∠»/«<», «°», «параллельн», «=») → Rule-JSON. **Acceptance: обе testdata-задачи парсятся без ИИ.**
   - **Фолбэк:** Gemini-клиент (`extractRulesGemini(text, apiKey, deps?)`) — REST `generativelanguage.googleapis.com`, `responseMimeType: application/json`, тот же Rule-JSON-контракт, DI-мок для тестов. Включается **только вручную** пользователем после просмотра результата парсера; API key вводится в UI и **не сохраняется** — только память вкладки (решение 2026-09-18), никогда не в репозитории/`.env`/localStorage.
   - **Human-in-the-loop шлюз:** извлечённые правила (любым путём) показываются в UI человекочитаемым списком; верификация запускается только после явного подтверждения.

## Domain Types (`src/pipeline/types.ts`)

```ts
interface Point {
  x: number;
  y: number;
}
interface LineSegment {
  id: string;
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}
interface Label {
  char: string;
  cx: number;
  cy: number;
} // центр буквы
interface Vertex {
  x: number;
  y: number;
  labels: string[];
}
// Rule (v1, dropdown) вытесняется RuleSpec (v2, из текста задачи):
type Segment = `${string}${string}`; // 'AB', 'BK', ...
type AngleName = `${string}${string}${string}`; // 'ABC', ...
type Relation =
  | { kind: 'angle'; angle: AngleName; degrees: number } // градусная мера (вкл. 90)
  | { kind: 'parallel'; a: Segment; b: Segment }
  | { kind: 'equal'; a: Segment; b: Segment }
  | { kind: 'on-segment'; point: string; segment: Segment }
  | { kind: 'median'; cevian: Segment; side: Segment } // BK к AC
  | { kind: 'bisector'; cevian: Segment; angle: AngleName } // BM угла ABC
  | { kind: 'height'; cevian: Segment; side: Segment }; // BM к AC
interface ParsedTask {
  points: string[]; // 'A','B','C','M','K',...
  relations: Relation[];
  givens: string[]; // «дано»: длины/единицы (не верифицируются, показываются в UI)
  source: 'parser' | 'gemini';
}
type VerifyStatus = 'Success' | 'Fail' | 'Error';
interface VerifyInput {
  /** Метка (заглавная A–Z) → вершина. */
  graph: Record<string, Vertex>;
  rule: Rule; // v1 — сохраняется до миграции
  /** Погрешность ε, по умолчанию EPS_DEFAULT (3.0). */
  epsilon?: number;
}
interface VerifyResult {
  status: VerifyStatus;
  message: string;
  deviation?: number;
  epsilon: number;
}
```

## Verification Formulas (ε = 3.0 by default)

| Rule              | Formula                                           | Pass condition                                          |
| ----------------- | ------------------------------------------------- | ------------------------------------------------------- |
| angle (мера N°)   | angle = acos(dot(BA, BC)/(\|BA\|·\|BC\|))         | \|angle − N\| ≤ ε (N=90 — перпендикулярность)           |
| parallel          | angle = asin(\|cross(AB, CD)\| / (\|AB\|·\|CD\|)) | angle ≤ ε                                               |
| equal-segments    | diff = \| \|AB\| − \|CD\| \|                      | diff ≤ ε px                                             |
| point-on-segment  | slack = (AM + MB) − AB                            | slack ≤ ε px (M between A and B by triangle inequality) |
| median (BK→AC)    | on-segment(K,AC) + \|AK − KC\|                    | оба частных правила ≤ ε                                 |
| bisector (BM∠ABC) | \|∠ABM − ∠MBC\|                                   | разность ≤ ε                                            |
| height (BM→AC)    | ∠(BM, AC) = 90° + K на прямой AC                  | ⊥ ≤ ε°, on-line ≤ ε px                                  |

**Контракт сообщений (обновлён ТЗ 2026-09-17):** fail `Ошибка: Угол на рисунке равен 84.12°, отклонение составляет 5.88°` (формат без имени угла; числа динамические, 2 знака). Софт-ошибка без изменений: `[Status: Error] Точка X не найдена на чертеже`. Для каждого типа правила — своё русское описание; итоговый вердикт агрегируется из списка результатов (Success ⇔ все правила Success).

## Failure Model

- Missing required label → `Error` with message `[Status: Error] Точка X не найдена на чертеже`. No exceptions, no crashes.
- Invalid/unparseable LLM output → soft error `[Status: Error] Не удалось разобрать текст задачи` (no crashes).
- Empty parser result (ни одного правила) → soft error, UI предлагает фолбэк-Gemini.

## Performance

- Бюджет «≤ 3 s» из ТЗ **убран** (ред. 2026-09-17). Downscale (`MAX_IMAGE_DIMENSION` 1600) и `StageTimings` остаются: даунскейл стабилизирует OCR/детекцию, тайминги показываются в UI. Gemini-вызов — сетевой, без бюджета.

## Env & Secrets

- **Без бэкенда и `.env`-ключей.** Решение (2026-09-17): дефолтный ключ в `.env` **не делаем** (в браузерном SPA `VITE_*` встраивается в бандл = публичный ключ; пользователь решил не хранить ключ вовсе). Google API key вводится пользователем в UI только для fallback-Gemini; **не хранится нигде — только память вкладки** (решение 2026-09-18, localStorage убран); никогда не в git.

## Critical Decisions

- **Browser-only execution (WASM)** — zero backend, deploys as static files. Dropped OpenCV/Tesseract quality vs a Python stack is acceptable for «цифровые» drawings (Accuracy ≥ 95% target) and keeps the project school-project simple.
- **All thresholds are constants** (`constants.ts`) — ТЗ-sourced, never redefined inline.
- **Pure-function pipeline** — each stage is a deterministic function over plain data, so it is unit-testable without a browser.
- **Text→rules: оффлайн-парсер основной, Gemini — фолбэк** (решение 2026-09-17): детерминизм + TDD + работа без сети; LLM только когда пользователь видит, что парсер не справился; верификация всегда после явного подтверждения правил пользователем (human-in-the-loop).
- **Не решаем задачу, а проверяем чертёж:** абсолютные длины («АС = 16 см») из текста не верифицируются (нет масштаба см→px) — извлекаются как «дано» и показываются в UI без проверки.
