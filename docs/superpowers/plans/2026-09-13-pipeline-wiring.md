# Pipeline Wiring + Result UI (Feature 06) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking. Execution mode was already chosen by the user approving act mode — do not re-ask (task-observer observation #3).

**Goal:** Wire the complete real pipeline (lines → dedup → OCR → graph → verify) into the SPA: «Проверить» runs the full analysis of the uploaded image, the canvas overlays detected segments/vertices/labels, and acceptance tests ТЗ §5 pass end to end.

**Architecture:** New pure async orchestrator `src/pipeline/run.ts` composes the five existing stage functions and returns everything the UI needs (verdict + overlay data + soft notes). OCR is injectable via `PipelineDeps` so unit tests stay deterministic; one real-WASM e2e proves the happy path. UI keeps the Phase-1 demo mode when no image is loaded; rule/ε changes after a successful analysis re-run only the cheap `verify()` on the stored graph (OCR/OpenCV never re-runs implicitly).

**Tech Stack:** Vanilla TS + Vite SPA, Vitest, OpenCV.js (`@techstark/opencv-js`), tesseract.js v7, puppeteer QA harness (`scripts/qa/ui-shell.mjs`).

## Global Constraints

- Vanilla TS + Vite SPA only; no framework, no Tailwind, no backend. Pipeline logic = pure functions in `src/pipeline/` (no DOM inside); DOM only in `src/ui/`.
- TypeScript strict incl. `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`; no `any`.
- All thresholds/constants live in `src/pipeline/constants.ts` — never inline. **No new constants are needed for this feature.**
- ТЗ message strings are contract: `[Status: Error] Точка X не найдена на чертеже`; `Ошибка: Угол ABC на рисунке равен 84.12°, отклонение составляет 5.88°`.
- UI copy in Russian; design tokens only (no raw hex in TS; canvas colors via `getComputedStyle` CSS variables — existing `cssVar()` pattern).
- Numbers in UI: `--font-num` + `tabular-nums`.
- **One commit per feature**: TDD red/green cycles stay uncommitted; single `feat(ui): wire real pipeline to result UI (acceptance §5)` commit at the end (docs + memory updates in the same commit). Commit subject = one line, no body.
- Gates on Windows PowerShell: `cmd /c "pnpm <cmd> && echo PASS || echo FAIL"` (pnpm.cmd exit codes are false negatives under PowerShell — task-observer observation #2).
- `.prettierignore` already excludes `product-brief.md` and vendored assets — do not remove entries; run `pnpm format:check` as part of gates.
- Do not modify `src/pipeline/lines.ts`, `dedup.ts`, `ocr.ts`, `graph.ts`, `verify.ts`, `constants.ts` in this feature — they are done and green.

## File Structure

- Create `src/pipeline/run.ts` — async orchestrator `analyzeDrawing()`; types `PipelineDeps`, `PipelineResult`. Only composition, no geometry.
- Create `src/pipeline/run.spec.ts` — DI unit tests (deterministic) + real-WASM e2e acceptance (ТЗ §5) with pure-TS raster fixtures (5×7 block font, pattern proven in `ocr.spec.ts`).
- Create `src/ui/image-input.ts` — `fileToRawImage(file: File): Promise<RawImage>`; thin DOM adapter, verified via QA harness (no unit test).
- Modify `src/ui/canvas-view.ts` — real-image contain-fit rendering + `CanvasOverlay` drawing (segments/vertices/labels through the same transform).
- Modify `src/ui/verdict-card.ts` — optional soft-notes list in `updateVerdictCard`, new `setVerdictPlaceholder`.
- Modify `src/ui/types.ts` — `AppState` gains `file`, `analysis`, `analyzing`.
- Modify `src/ui/app.ts` — pipeline trigger on «Проверить», cheap re-verify on rule/ε change, busy state, soft notes pass-through.
- Modify `src/styles.css` — disabled button + verdict-notes styles (tokens only).
- Modify `scripts/qa/ui-shell.mjs` — headless live verification of the real pipeline (upload in-page generated PNG, click «Проверить», assert verdict; blank-image unhappy path).
- Update docs at the end: `context/build-plan.md`, `context/progress-tracker.md`, `context/ui-registry.md`, `context/architecture.md`, `memory.md`.

---

### Task 1: Pipeline orchestrator `src/pipeline/run.ts` (TDD, DI)

**Files:**
- Create: `src/pipeline/run.ts`
- Test: `src/pipeline/run.spec.ts`

**Interfaces:**
- Consumes: `detectSegments(image: RawImage): Promise<LineSegment[]>` (`./lines`); `deduplicateSegments(segments: LineSegment[]): LineSegment[]` (`./dedup`); `recognizeLabels(image: RawImage): Promise<Label[]>` (`./ocr`); `buildGraph(segments, labels): GraphResult` (`./graph`); `verify(input: VerifyInput): VerifyResult` (`./verify`); `RawImage` (`./lines`).
- Produces (used by Tasks 3–5 and QA):

```ts
export interface PipelineDeps {
  detectSegments?: (image: RawImage) => Promise<LineSegment[]>;
  recognizeLabels?: (image: RawImage) => Promise<Label[]>;
}

export interface PipelineResult {
  readonly segments: LineSegment[];
  readonly labels: Label[];
  readonly vertices: Vertex[];
  readonly graph: Record<string, Vertex>;
  readonly unboundLabels: Label[];
  readonly verdict: VerifyResult;
}

export async function analyzeDrawing(
  image: RawImage,
  rule: Rule,
  epsilon: number,
  deps?: PipelineDeps,
): Promise<PipelineResult>;
```

- [ ] **Step 1: Write the failing tests**

Create `src/pipeline/run.spec.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { analyzeDrawing, type PipelineDeps } from './run';
import type { RawImage } from './lines';
import type { Label, LineSegment } from './types';

/** Любой растр: стадии подменены через DI, пиксели не используются. */
const BLANK: RawImage = { width: 2, height: 2, data: new Uint8ClampedArray(16).fill(255) };

function seg(id: string, x1: number, y1: number, x2: number, y2: number): LineSegment {
  return { id, x1, y1, x2, y2 };
}
function label(char: string, cx: number, cy: number): Label {
  return { char, cx, cy };
}
function stubDeps(segments: LineSegment[], labels: Label[]): PipelineDeps {
  return { detectSegments: async () => segments, recognizeLabels: async () => labels };
}

/** Прямой угол при B: AB вертикаль, BC горизонталь (паттерн demo-drawings). */
const IDEAL: LineSegment[] = [
  seg('ab', 300, 100, 300, 320),
  seg('bc', 300, 320, 520, 320),
  seg('cd', 520, 320, 520, 100),
];
const IDEAL_LABELS: Label[] = [
  label('A', 284, 92),
  label('B', 284, 328),
  label('C', 536, 328),
];

describe('analyzeDrawing (DI, детерминированно)', () => {
  it('проводит стадии: идеальный прямой угол → Success с точным текстом', async () => {
    const result = await analyzeDrawing(BLANK, 'perpendicular', 3, stubDeps(IDEAL, IDEAL_LABELS));
    expect(result.segments.map((s) => s.id)).toEqual(['seg-0', 'seg-1', 'seg-2']);
    expect(result.graph.A).toBeDefined();
    expect(result.graph.B).toBeDefined();
    expect(result.graph.C).toBeDefined();
    expect(result.verdict.status).toBe('Success');
    expect(result.verdict.message).toBe('Верно: угол ABC = 90.00° (в пределах ε = 3.00)');
    expect(result.verdict.epsilon).toBe(3);
    expect(result.unboundLabels).toEqual([]);
  });

  it('пустая детекция → мягкая ошибка «отрезков не найдено», оверлей пуст', async () => {
    const result = await analyzeDrawing(BLANK, 'perpendicular', 3, stubDeps([], []));
    expect(result.segments).toEqual([]);
    expect(result.vertices).toEqual([]);
    expect(result.graph).toEqual({});
    expect(result.verdict.status).toBe('Error');
    expect(result.verdict.message).toBe('[Status: Error] На чертеже не найдено отрезков');
  });

  it('метки не распознались → мягкая ошибка ТЗ про точку A', async () => {
    const result = await analyzeDrawing(BLANK, 'perpendicular', 3, stubDeps(IDEAL, []));
    expect(result.verdict.status).toBe('Error');
    expect(result.verdict.message).toBe('[Status: Error] Точка A не найдена на чертеже');
  });

  it('метка без вершины в радиусе 40 px попадает в unboundLabels', async () => {
    const labels = [...IDEAL_LABELS, label('Z', 100, 550)];
    const result = await analyzeDrawing(BLANK, 'perpendicular', 3, stubDeps(IDEAL, labels));
    expect(result.unboundLabels).toEqual([label('Z', 100, 550)]);
    expect(result.graph.Z).toBeUndefined();
    expect(result.verdict.status).toBe('Success');
  });

  it('дедупликация выполняется внутри проводки (дубль AB сливается)', async () => {
    const dup: LineSegment[] = [
      seg('ab1', 300, 100, 300, 320),
      seg('ab2', 303, 100, 303, 320),
      seg('bc', 300, 320, 520, 320),
    ];
    const result = await analyzeDrawing(BLANK, 'perpendicular', 3, stubDeps(dup, IDEAL_LABELS));
    expect(result.segments).toHaveLength(2);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cmd /c "pnpm vitest run src/pipeline/run.spec.ts && echo PASS || echo FAIL"`
Expected: FAIL — `Failed to resolve import "./run"`.

---

### Task 2: Acceptance ТЗ §5 — DI-уровень

**Files:**
- Test: `src/pipeline/run.spec.ts` (append)

**Interfaces:**
- Consumes: `analyzeDrawing` + `PipelineDeps` (Task 1); `TILTED_DEMO` (`../mock/demo-drawings` — segments/labels/mock-граф сцены 84.12°).
- Produces: acceptance-доказательства ТЗ §5: (2) 84.12° при ε = 3 → Fail с точным текстом; (3) M за точкой B → Fail; плюс софт-ошибка «Точка M не найдена на чертеже».

Geometry notes (проверены по семантике стадий):
- Тик (короткий поперечный отрезок) даёт кандидата-пересечение в точке перекрестия (в допуске `ON_SEGMENT_TOLERANCE` 2 px). Концы тика в 30 px друг от друга НЕ сливаются (`VERTEX_MERGE_RADIUS` 5) — метку ставим в 40 px от *намеченной* вершины и дальше от концов тика.
- «M за точкой B» без тика невозможна: метка M привяжется к B (ближайшая вершина) и даст Success — поэтому тик обязателен.

- [ ] **Step 1: Add DI acceptance tests to `run.spec.ts` (append after the existing describe)**

```ts
import { TILTED_DEMO } from '../mock/demo-drawings';

/** ТЗ §5, кейс 2: ∠ABC = 84.12° при ε = 3 → Fail с точным текстом (DI). */
describe('analyzeDrawing — acceptance ТЗ §5 (DI)', () => {
  it('84.12° при ε = 3 → Fail: «Ошибка: Угол ABC на рисунке равен 84.12°…»', async () => {
    const result = await analyzeDrawing(BLANK, 'perpendicular', 3, {
      detectSegments: async () => [...TILTED_DEMO.segments],
      recognizeLabels: async () => [...TILTED_DEMO.labels],
    });
    expect(result.verdict.status).toBe('Fail');
    expect(result.verdict.message).toBe(
      'Ошибка: Угол ABC на рисунке равен 84.12°, отклонение составляет 5.88°',
    );
  });

  it('M на отрезке AB (пересечение с тиком) → Success point-on-segment', async () => {
    const segments = [seg('ab', 300, 100, 300, 320), seg('tick', 285, 210, 315, 210)];
    const labels = [label('A', 284, 92), label('B', 278, 336), label('M', 300, 180)];
    const result = await analyzeDrawing(BLANK, 'point-on-segment', 3, stubDeps(segments, labels));
    expect(result.graph.M).toBeDefined();
    expect(result.verdict.status).toBe('Success');
    expect(result.verdict.message).toBe('Верно: точка M принадлежит отрезку AB');
  });

  it('M за точкой B (тик за пределами AB) → Fail со смещением', async () => {
    const segments = [seg('ab', 300, 100, 300, 320), seg('tick', 285, 340, 315, 340)];
    const labels = [label('A', 284, 92), label('B', 278, 308), label('M', 312, 352)];
    const result = await analyzeDrawing(BLANK, 'point-on-segment', 3, stubDeps(segments, labels));
    expect(result.verdict.status).toBe('Fail');
    expect(result.verdict.message.startsWith('Ошибка: Точка M не лежит на отрезке AB')).toBe(true);
  });

  it('метка M слишком далеко от любой вершины → мягкая ошибка ТЗ', async () => {
    const segments = [seg('ab', 300, 100, 300, 320)];
    const labels = [label('A', 284, 92), label('B', 278, 308), label('M', 100, 550)];
    const result = await analyzeDrawing(BLANK, 'point-on-segment', 3, stubDeps(segments, labels));
    expect(result.verdict.status).toBe('Error');
    expect(result.verdict.message).toBe('[Status: Error] Точка M не найдена на чертеже');
  });
});
```

- [ ] **Step 2: Run — new tests may expose binding surprises**

Run: `cmd /c "pnpm vitest run src/pipeline/run.spec.ts && echo PASS || echo FAIL"`
Expected: новые DI-тесты могут FAIL (привязка меток/геометрия тика). Правило: сначала правим *геометрию теста* (ожидания), не код стадий; `run.ts` правим только если сломана сама композиция.

- [ ] **Step 3: Add the real-WASM e2e acceptance test (ТЗ §5, кейс 1)**

Append to `run.spec.ts` (raster helpers reuse the pattern proven in `ocr.spec.ts`; glyph scale 16 → 80×112, распознанный с conf ≥ 60):

```ts
const FONT_5X7: Record<string, string[]> = {
  A: ['01110', '10001', '10001', '11111', '10001', '10001', '10001'],
  B: ['11110', '10001', '10001', '11110', '10001', '10001', '11110'],
  C: ['01111', '10000', '10000', '10000', '10000', '10000', '01111'],
};

/** Белый холст + заливка пикселя (паттерн ocr.spec.ts). */
function makeCanvas(width: number, height: number) {
  const data = new Uint8ClampedArray(width * height * 4).fill(255);
  const setBlack = (x: number, y: number): void => {
    const i = (y * width + x) * 4;
    data[i] = 0;
    data[i + 1] = 0;
    data[i + 2] = 0;
  };
  return { data, setBlack };
}

/** Толстая линия: квадрат thickness×thickness вдоль отрезка с шагом 0.5 px. */
function drawThickLine(
  setBlack: (x: number, y: number) => void,
  x1: number, y1: number, x2: number, y2: number,
  thickness = 3,
): void {
  const steps = Math.ceil(Math.hypot(x2 - x1, y2 - y1) * 2);
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const cx = Math.round(x1 + (x2 - x1) * t);
    const cy = Math.round(y1 + (y2 - y1) * t);
    for (let dy = -thickness; dy <= thickness; dy++) {
      for (let dx = -thickness; dx <= thickness; dx++) setBlack(cx + dx, cy + dy);
    }
  }
}

/** Глиф 5×7 × scale; origin — левый верхний угол глифа. */
function drawLetter(
  setBlack: (x: number, y: number) => void,
  ch: string, originX: number, originY: number, scale = 16,
): void {
  FONT_5X7[ch]!.forEach((row, ry) => {
    [...row].forEach((cell, rx) => {
      if (cell !== '1') return;
      for (let dy = 0; dy < scale; dy++) {
        for (let dx = 0; dx < scale; dx++) setBlack(originX + rx * scale + dx, originY + ry * scale + dy);
      }
    });
  });
}

/** ТЗ §5, кейс 1: прямоугольный треугольник A(100,100) B(100,300) C(300,300). */
function rightTriangleImage(): RawImage {
  const { data, setBlack } = makeCanvas(480, 480);
  drawThickLine(setBlack, 100, 100, 100, 300);
  drawThickLine(setBlack, 100, 300, 300, 300);
  // Центр глифа = вершина + (24, 24) → origin = вершина + (−16, −32).
  drawLetter(setBlack, 'A', 84, 68);
  drawLetter(setBlack, 'B', 84, 268);
  drawLetter(setBlack, 'C', 284, 268);
  return { width: 480, height: 480, data };
}

describe('analyzeDrawing (e2e, WASM: OpenCV + tesseract)', () => {
  it('прямоугольный треугольник → Success (acceptance ТЗ §5)', async () => {
    const result = await analyzeDrawing(rightTriangleImage(), 'perpendicular', 3);
    expect(Object.keys(result.graph)).toEqual(expect.arrayContaining(['A', 'B', 'C']));
    expect(result.verdict.status).toBe('Success');
    expect(result.verdict.message.startsWith('Верно: угол ABC')).toBe(true);
  }, 120000);
});
```

- [ ] **Step 4: Run the full spec**

Run: `cmd /c "pnpm vitest run src/pipeline/run.spec.ts && echo PASS || echo FAIL"`
Expected: PASS (5 DI + 4 acceptance-DI + 1 e2e WASM). Если e2e нестабилен по OCR — увеличить глиф (scale 20) или сместить букву в пустой квадрант; код стадий не трогать. Если e2e остаётся flaky после двух итераций — оставить его `it.skip` с комментарием причины и опираться на DI-acceptance (решение зафиксировать в memory).

- [ ] **Step 5: Gates (uncommitted)**

Run: `cmd /c "pnpm test && pnpm typecheck && pnpm lint && echo PASS || echo FAIL"`
Expected: PASS.

---

### Task 4: Оверлей реального чертежа (`canvas-view.ts`)

**Files:**
- Modify: `src/ui/canvas-view.ts`

**Interfaces:**
- Consumes: `LineSegment`, `Label`, `Vertex` (`../pipeline/types`); `DemoDrawing` (`../mock/demo-drawings`).
- Produces (используют Tasks 5–6):

```ts
export interface CanvasOverlay {
  readonly segments: readonly LineSegment[];
  readonly vertices: readonly Vertex[];
  readonly labels: readonly Label[];
}
export function renderCanvas(
  canvas: HTMLCanvasElement,
  drawing: DemoDrawing,
  imageUrl: string | null,
  overlay?: CanvasOverlay | null,
): void;
```

- [ ] **Step 1: Add imports and the shared overlay painter**

Add to imports at the top:

```ts
import type { Label, LineSegment, Vertex } from '../pipeline/types';
```

Add after `cssVar`:

```ts
export interface CanvasOverlay {
  readonly segments: readonly LineSegment[];
  readonly vertices: readonly Vertex[];
  readonly labels: readonly Label[];
}

/** Оверлей распознанного: сегменты accent, вершины ink-3, метки info. */
function drawOverlay(
  ctx: CanvasRenderingContext2D,
  overlay: CanvasOverlay,
  scale: number,
  offsetX: number,
  offsetY: number,
): void {
  ctx.save();
  ctx.translate(offsetX, offsetY);
  ctx.scale(scale, scale);
  ctx.strokeStyle = cssVar('--color-accent');
  ctx.lineWidth = 2 / scale;
  ctx.lineCap = 'round';
  for (const s of overlay.segments) {
    ctx.beginPath();
    ctx.moveTo(s.x1, s.y1);
    ctx.lineTo(s.x2, s.y2);
    ctx.stroke();
  }
  ctx.fillStyle = cssVar('--color-ink-3');
  const r = 4 / scale;
  for (const v of overlay.vertices) {
    ctx.beginPath();
    ctx.arc(v.x, v.y, r, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.fillStyle = cssVar('--color-info');
  ctx.font = '600 16px "JetBrains Mono", ui-monospace, monospace';
  ctx.textAlign = 'center';
  for (const l of overlay.labels) {
    ctx.fillText(l.char, l.cx, l.cy - 18 / scale);
  }
  ctx.restore();
}
```

- [ ] **Step 2: Refactor `drawDemo` to delegate; make image branch contain-fit + overlay**

Replace the drawing part of `drawDemo` (всё после вычисления `scale/offsetX/offsetY`) на:

```ts
  const overlay: CanvasOverlay = {
    segments: drawing.segments,
    vertices: Object.values(drawing.graph),
    labels: drawing.labels,
  };
  drawOverlay(ctx, overlay, scale, offsetX, offsetY);
```

Replace the `if (imageUrl)` branch of `renderCanvas` на (contain-fit вместо stretch, оверлей поверх):

```ts
  if (imageUrl) {
    const img = document.createElement('img');
    img.addEventListener('load', () => {
      const iw = img.naturalWidth || img.width;
      const ih = img.naturalHeight || img.height;
      const scale = Math.min(width / iw, height / ih);
      const offsetX = (width - iw * scale) / 2;
      const offsetY = (height - ih * scale) / 2;
      ctx.drawImage(img, offsetX, offsetY, iw * scale, ih * scale);
      if (overlay) {
        drawOverlay(ctx, overlay, scale, offsetX, offsetY);
      }
    });
    img.src = imageUrl;
    return;
  }
```

Also update the canvas-note text in `createCanvasCard`:

```ts
  note.textContent =
    'Загрузите чертёж и нажмите «Проверить»: поверх изображения показываются распознанные отрезки, вершины и метки.';
```

- [ ] **Step 3: Gates (uncommitted)**

Run: `cmd /c "pnpm typecheck && pnpm lint && echo PASS || echo FAIL"`
Expected: PASS — новый параметр `overlay` опционален, старый вызов в `app.ts` совместим.

---

### Task 5: Софт-ноты, стили, состояние, проводка

**Files:**
- Modify: `src/ui/verdict-card.ts`, `src/styles.css`, `src/ui/types.ts`, `src/ui/app.ts`

**Interfaces:**
- Consumes: `analyzeDrawing`, `PipelineResult` (Task 1); `fileToRawImage` (Task 3); `CanvasOverlay`, `renderCanvas` (Task 4).
- Produces: готовое SPA поведение (использует QA Task 6):
  - `updateVerdictCard(card, verdict, notes?: readonly string[])`;
  - `setVerdictPlaceholder(card, text)`;
  - `AppState` новые поля: `file: File | null`, `analysis: PipelineResult | null`, `analyzing: boolean`.

- [ ] **Step 1: Update `src/ui/verdict-card.ts`**

Replace `updateVerdictCard` and add `setVerdictPlaceholder`:

```ts
/** Обновление карточки вердикта (скринридер: aria-live); notes — софт-ноты. */
export function updateVerdictCard(
  card: HTMLElement,
  verdict: VerifyResult,
  notes: readonly string[] = [],
): void {
  const region = card.querySelector('#verdict-region');
  if (!region) {
    return;
  }
  const badge = createVerdictBadge(verdict.status);
  const message = paragraph('verdict-message', verdict.message);
  const meta = paragraph('verdict-meta', `ε = ${formatEpsilon(verdict.epsilon)}`);
  const children: HTMLElement[] = [badge, message, meta];
  if (notes.length > 0) {
    const wrap = document.createElement('div');
    wrap.className = 'verdict-notes';
    for (const note of notes) {
      const el = document.createElement('p');
      el.className = 'verdict-note';
      el.textContent = note;
      wrap.append(el);
    }
    children.push(wrap);
  }
  region.replaceChildren(...children);
}

/** Плейсхолдер между запусками (например, после загрузки нового файла). */
export function setVerdictPlaceholder(card: HTMLElement, text: string): void {
  const region = card.querySelector('#verdict-region');
  if (!region) {
    return;
  }
  region.replaceChildren(paragraph('verdict-empty', text));
}
```

- [ ] **Step 2: Append to `src/styles.css` (tokens only)**

```css
.btn-primary:disabled {
  opacity: 0.6;
  cursor: default;
}

.verdict-notes {
  margin-top: 8px;
  display: grid;
  gap: 4px;
}

.verdict-note {
  font-size: 0.8125rem;
  color: var(--color-ink-3);
}
```

- [ ] **Step 3: Update `src/ui/types.ts`**

Add import `import type { PipelineResult } from '../pipeline/run';` and replace `AppState`/`createInitialState` with:

```ts
export interface AppState {
  demo: DemoDrawing;
  rule: Rule;
  epsilon: number;
  /** Object URL превью загруженного изображения (null — демо-чертёж). */
  imageUrl: string | null;
  /** Последний выбранный файл — источник повторного анализа. */
  file: File | null;
  /** Результат полного пайплайна (null — демо-режим или ещё не анализировали). */
  analysis: PipelineResult | null;
  /** Идёт полный анализ (OCR/OpenCV) — кнопка заблокирована. */
  analyzing: boolean;
  lastVerdict: VerifyResult | null;
}

export function createInitialState(): AppState {
  return {
    demo: IDEAL_DEMO,
    rule: 'perpendicular',
    epsilon: EPS_DEFAULT,
    imageUrl: null,
    file: null,
    analysis: null,
    analyzing: false,
    lastVerdict: null,
  };
}
```

- [ ] **Step 4: Update `src/ui/app.ts`**

New imports:

```ts
import { analyzeDrawing, type PipelineResult } from '../pipeline/run';
import { fileToRawImage } from './image-input';
import { createCanvasCard, renderCanvas, type CanvasOverlay } from './canvas-view';
import { createVerdictCard, setVerdictPlaceholder, updateVerdictCard } from './verdict-card';
```

Button click: `verifyButton.addEventListener('click', () => { void runPipeline(); });`
Boot call at the bottom of `createApp`: replace `run();` with `runDemo();`.

Replace the functions after `createScenarioSelect` with (delete old `update`, `refreshCanvas`, `run`):

```ts
  function update(patch: Partial<AppState>): void {
    Object.assign(state, patch);
    refreshCanvas();
    refreshVerdict();
  }

  function refreshCanvas(): void {
    renderCanvas(canvas, state.demo, state.imageUrl, overlay());
  }

  function overlay(): CanvasOverlay | null {
    if (!state.analysis) {
      return null;
    }
    return {
      segments: state.analysis.segments,
      vertices: state.analysis.vertices,
      labels: state.analysis.labels,
    };
  }

  /** Демо-режим: мгновенный verify() на графе демо-сцены (без CV/OCR). */
  function runDemo(): void {
    applyVerdict(verify({ graph: state.demo.graph, rule: state.rule, epsilon: state.epsilon }), []);
  }

  /** Пересчёт вердикта: полный анализ не повторяем — граф уже построен. */
  function refreshVerdict(): void {
    if (state.analysis) {
      const verdict = verify({
        graph: state.analysis.graph,
        rule: state.rule,
        epsilon: state.epsilon,
      });
      applyVerdict(verdict, state.analysis.unboundLabels);
    } else if (!state.imageUrl) {
      runDemo();
    }
    // imageUrl && !analysis → ждём «Проверить»; карточку не трогаем.
  }

  /** Полный анализ загруженного изображения (кнопка «Проверить»). */
  async function runPipeline(): Promise<void> {
    if (!state.imageUrl) {
      runDemo();
      return;
    }
    if (!state.file || state.analyzing) {
      return;
    }
    setBusy(true);
    try {
      const raw = await fileToRawImage(state.file);
      const analysis: PipelineResult = await analyzeDrawing(raw, state.rule, state.epsilon);
      state.analysis = analysis;
      refreshCanvas();
      applyVerdict(analysis.verdict, analysis.unboundLabels);
    } catch {
      applyVerdict(
        {
          status: 'Error',
          message: '[Status: Error] Не удалось обработать изображение',
          epsilon: state.epsilon,
        },
        [],
      );
    } finally {
      setBusy(false);
    }
  }

  function setBusy(busy: boolean): void {
    state.analyzing = busy;
    verifyButton.disabled = busy;
    verifyButton.textContent = busy ? 'Анализ…' : 'Проверить';
  }

  function applyVerdict(verdict: VerifyResult, notes: readonly string[]): void {
    state.lastVerdict = verdict;
    updateVerdictCard(verdictCard, verdict, notes);
    updateStatusDot(verdict.status);
  }

  function onFile(file: File): void {
    if (state.imageUrl) {
      URL.revokeObjectURL(state.imageUrl);
    }
    state.analysis = null;
    update({ file, imageUrl: URL.createObjectURL(file) });
    setVerdictPlaceholder(verdictCard, 'Изображение загружено. Нажмите «Проверить» для анализа.');
  }
```

`updateStatusDot`, `onRuleChange`, `onEpsilonChange` — без изменений.

- [ ] **Step 5: Gates (uncommitted)**

Run: `cmd /c "pnpm test && pnpm typecheck && pnpm lint && pnpm format:check && echo PASS || echo FAIL"`
Expected: PASS.

---

### Task 6: Headless live-verification QA (`scripts/qa/ui-shell.mjs`)

**Files:**
- Modify: `scripts/qa/ui-shell.mjs`

**Interfaces:**
- Consumes: built `dist/` (Task 7 gates run `pnpm build` first via `pnpm qa`); in-page canvas fixture generator (PNG → File → drop, паттерн существующего шага 8).
- Produces: QA-проверки 9–12 реального пайплайна; существующие шаги 1–8 не меняются, шаг 9 (консоль) переносится в конец.

- [ ] **Step 1: Move the console-noise check (current step 9) to the very end of the try block** (after the new steps below), keeping its code unchanged.

- [ ] **Step 2: Insert new steps before the console check**

```js
  // 9. Реальный пайплайн: рисуем чертёж-контур с метками прямо в браузере.
  // Буквы — блочный шрифт 5×7 × 8 (глиф 40×56): проверенный OCR-паттерн,
  // глифы в пустых квадрантах вершин — не пересекаются с линиями.
  const drawingPng = await page.evaluate(async () => {
    const FONT = {
      A: ['01110', '10001', '10001', '11111', '10001', '10001', '10001'],
      B: ['11110', '10001', '10001', '11110', '10001', '10001', '11110'],
      C: ['01111', '10000', '10000', '10000', '10000', '10000', '01111'],
      D: ['11110', '10001', '10001', '10001', '10001', '10001', '11110'],
    };
    const c = document.createElement('canvas');
    c.width = 800;
    c.height = 600;
    const ctx = c.getContext('2d');
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, 800, 600);
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = 6;
    ctx.lineCap = 'round';
    const seg = (x1, y1, x2, y2) => {
      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.lineTo(x2, y2);
      ctx.stroke();
    };
    // Прямоугольник A(200,120) B(200,460) C(520,460) D(520,120).
    seg(200, 120, 200, 460);
    seg(200, 460, 520, 460);
    seg(520, 460, 520, 120);
    seg(520, 120, 200, 120);
    const letter = (ch, ox, oy) => {
      ctx.fillStyle = '#000000';
      FONT[ch].forEach((row, ry) => {
        [...row].forEach((cell, rx) => {
          if (cell === '1') ctx.fillRect(ox + rx * 8, oy + ry * 8, 8, 8);
        });
      });
    };
    // Центр глифа = origin + (20, 28); расстояние до вершины ~39.6 ≤ 40 px.
    letter('A', 152, 64); // центр (172, 92) — вверх-влево от A
    letter('B', 152, 460); // центр (172, 488) — вниз-влево от B
    letter('C', 528, 460); // центр (548, 488) — вниз-вправо от C
    letter('D', 528, 64); // центр (548, 92) — вверх-вправо от D
    const blob = await new Promise((resolve) => c.toBlob(resolve, 'image/png'));
    return Array.from(new Uint8Array(await blob.arrayBuffer()));
  });
  await page.evaluate((bytes) => {
    const file = new File([new Uint8Array(bytes)], 'drawing.png', { type: 'image/png' });
    const dt = new DataTransfer();
    dt.items.add(file);
    document
      .querySelector('.upload-zone')
      .dispatchEvent(new DragEvent('drop', { bubbles: true, cancelable: true, dataTransfer: dt }));
  }, drawingPng);
  await page.click('.btn-primary');
  await page.waitForFunction(
    () => document.querySelector('.badge')?.textContent === 'Верно',
    { timeout: 60000 },
  );
  const realMsg = await page.$eval('.verdict-message', (el) => el.textContent);
  check('реальный пайплайн: контур с A/B/C/D → Success (угол ABC)', realMsg.includes('угол ABC'));

  // 10. После анализа смена правила — мгновенный verify() на сохранённом графе.
  await page.select('#rule-select', 'parallel');
  await page.waitForFunction(
    () => document.querySelector('.verdict-message')?.textContent.includes('параллельны'),
    { timeout: 5000 },
  );
  check(
    'после анализа: parallel → мгновенный Success без повторного OCR',
    (await page.$eval('.badge', (el) => el.textContent)) === 'Верно',
  );

  // 11. Unhappy path: пустой чертёж → мягкая ошибка «не найдено отрезков».
  const blankPng = await page.evaluate(async () => {
    const c = document.createElement('canvas');
    c.width = 200;
    c.height = 200;
    const ctx = c.getContext('2d');
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, 200, 200);
    const blob = await new Promise((resolve) => c.toBlob(resolve, 'image/png'));
    return Array.from(new Uint8Array(await blob.arrayBuffer()));
  });
  await page.evaluate((bytes) => {
    const file = new File([new Uint8Array(bytes)], 'blank.png', { type: 'image/png' });
    const dt = new DataTransfer();
    dt.items.add(file);
    document
      .querySelector('.upload-zone')
      .dispatchEvent(new DragEvent('drop', { bubbles: true, cancelable: true, dataTransfer: dt }));
  }, blankPng);
  await page.click('.btn-primary');
  const blankMsg = await page.waitForFunction(
    () => document.querySelector('.verdict-message')?.textContent ?? null,
    { timeout: 60000 },
  );
  check(
    'пустой чертёж: мягкая ошибка «на чертеже не найдено отрезков»',
    blankMsg?.toString().includes('не найдено отрезков') ?? false,
  );
```

Note: drag-drop существующего шага 8 (не-изображение) остаётся выше; после него состояние `imageUrl` не меняется (ошибка валидации), поэтому шаг 9 корректно стартует с демо-режима.

- [ ] **Step 3: Run the live QA**

Run: `cmd /c "pnpm qa && echo PASS || echo FAIL"`
Expected: PASS — 12/12 assertions (1–8 прежние, 9–11 новые, консоль чистая). OCR/WASM в headless Chrome может работать ~10–30 с — таймауты 60 с заданы.

---

### Task 7: Полная верификационная лестница, документация, единый коммит

**Files:**
- Modify: `context/build-plan.md`, `context/progress-tracker.md`, `context/ui-registry.md`, `context/architecture.md`, `memory.md`

- [ ] **Step 1: Full gates**

Run: `cmd /c "pnpm test && pnpm typecheck && pnpm lint && pnpm format:check && pnpm build && echo PASS || echo FAIL"`
Expected: PASS (все юнит-тесты + typecheck + 0 lint warnings + format + build). `pnpm qa` уже зелёный из Task 6.

- [ ] **Step 2: Update docs**

- `context/build-plan.md`: пометить `### 06 verify.ts + result UI` как `**Done 2026-09-13**` с краткой сводкой (run.ts DI-оркестратор, оверлей, софт-ноты, QA 12/12); отметить `[x] 06` в чек-листе.
- `context/progress-tracker.md`: Phase 4 `06` → `[x]`, «Last completed» и «Next / open point» → Phase 5 (07 Performance & polish).
- `context/ui-registry.md`: добавить строку `image-input | shipped | File → RawImage (DOM-адаптер) | src/ui/image-input.ts fileToRawImage; QA-проверка`; обновить Notes у `canvas-view` (real-image contain-fit + `CanvasOverlay`) и `verdict-card` (notes, placeholder).
- `context/architecture.md`: отметить стадию 5 «проводка» — `src/pipeline/run.ts` (`analyzeDrawing`), DI для OCR, правило «rule/ε → только verify() на сохранённом графе».
- `memory.md`: через `/remember save` в конце сессии.

- [ ] **Step 3: Single feature commit (subject only, one line)**

```bash
git add -A
git commit -m "feat(ui): wire real pipeline to result UI (acceptance §5)"
```

Проверка перед коммитом: `git log --oneline -1` — одна строка subject, без body. Если `pnpm format:check` ругается на новые файлы — сначала `pnpm format` (кроме защищённых путей), затем коммит.

---

## Self-Review (выполнено при написании)

1. **Spec coverage (ТЗ §5 + build-plan 06):** прямоугольный треугольник → Success — Task 2 Step 3 (e2e WASM) + QA шаг 9; 84.12° при ε=3 → точный Fail-текст — Task 2 Step 1 (DI) + существующий QA шаг 5; M за B → Fail — Task 2 Step 1; проводка реального пайплайна в вердикт — Task 5; оверлей линий/меток/вершин — Task 4; софт-ошибки (`unboundLabels`, пустая детекция, «Точка X не найдена») — Tasks 1, 5, QA шаг 11.
2. **Placeholders:** нет TBD/TODO; все шаги содержат полный код или точную правку.
3. **Type consistency:** `PipelineResult`/`CanvasOverlay`/`AppState` поля согласованы между Tasks 1, 4, 5; сигнатура `updateVerdictCard(card, verdict, notes?)` совпадает в Task 5 и вызове `applyVerdict`; `fileToRawImage` используется только в `app.ts`.

## Known risks

- OCR на синтетических глифах (vitest e2e и QA шаг 9) — самый хрупкий элемент; при флаке: масштаб глифа ↑, позиция в пустой квадрант, и только затем `it.skip` с фиксацией в memory.
- 40 px `LABEL_RADIUS` требует точного позиционирования меток в фиксстурах — геометрия в плане просчитана, но первый прогон может потребовать сдвига (меняем тест, не стадии).