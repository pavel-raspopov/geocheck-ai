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
3. **ocr** — single Latin letters A–Z (uppercase), center coordinates. Implemented in `src/pipeline/ocr.ts` (`recognizeLabels`, async): `RawImage` → pure-TS BMP encoder (v7 `loadImage` accepts no raw pixels; worker detects BMP magic and re-encodes for Leptonica) → tesseract.js worker (module-cached, LSTM_ONLY, PSM 11 sparse, local bundle `public/tessdata` + `public/tesseract`, `cacheMethod:'none'`) → pure post-filter `extractLabels` (LSTM ignores `tessedit_char_whitelist`): uppercase, strict `[A-Z]`, confidence ≥ 60, bbox center, deterministic order (cy ↑, cx ↑).
4. **graph** — vertex = intersection of deduped segments; bind letter → nearest vertex ≤ 40 px.
5. **verify** — selected rule with ε (default 3.0).

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
type Rule = 'perpendicular' | 'parallel' | 'equal-segments' | 'point-on-segment';
type VerifyStatus = 'Success' | 'Fail' | 'Error';
interface VerifyInput {
  graph: Record<string, Vertex>;
  rule: Rule;
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

| Rule             | Formula                    | Pass condition                                          |
| ---------------- | -------------------------- | ------------------------------------------------------- |
| perpendicular    | angle = acos(dot(BA, BC)/( | BA                                                      |     | BC  | ))  |     | angle − 90 | ≤ ε         |
| parallel         | angle = asin(              | cross(AB, CD)                                           | /(  | AB  |     | CD  | ))         | angle ≤ ε   |
| equal-segments   | diff =                     |                                                         | AB  | −   | CD  |     |            | diff ≤ ε px |
| point-on-segment | slack = (AM + MB) − AB     | slack ≤ ε px (M between A and B by triangle inequality) |

## Failure Model

- Missing required label → `Error` with message `[Status: Error] Точка X не найдена на чертеже`. No exceptions, no crashes.
- Message formats (RU) are contract and live beside the formulas in `verify.ts`: fail `Ошибка: Угол ABC на рисунке равен 84.12°, отклонение составляет 5.88°` (numbers rounded to 2 decimals via `MESSAGE_DECIMALS`).

## Performance

- Budget ≤ 3 s per image on CPU. Image is downscaled before detection if needed; heavy WASM loads (@opencv, @tesseract) are **lazy** (`await import(...)` inside async stage functions) — measured in Phase 5 on a demo drawing.

## Env & Secrets

- None. Browser-only; no `.env`, no API keys.

## Critical Decisions

- **Browser-only execution (WASM)** — zero backend, deploys as static files. Dropped OpenCV/Tesseract quality vs a Python stack is acceptable for «цифровые» drawings (Accuracy ≥ 95% target) and keeps the project school-project simple.
- **All thresholds are constants** (`constants.ts`) — ТЗ-sourced, never redefined inline.
- **Pure-function pipeline** — each stage is a deterministic function over plain data, so it is unit-testable without a browser.
