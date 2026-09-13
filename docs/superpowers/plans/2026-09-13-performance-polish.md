# Performance & polish (Phase 5 — 07) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** удержать полный пайплайн в бюджете ≤ 3 s на CPU (замер + даунскейл), закрыть error/empty-state UX, пройти a11y и дописать финальный README.

**Architecture:** решение о даунскейле — чистая функция в `src/pipeline/scale.ts` (константа `MAX_IMAGE_DIMENSION` в `constants.ts`); декод/даунскейл/превью — в DOM-адаптере `image-input.ts` (превью и анализ всегда одного размера — оверлей совпадает без пересчёта координат). Замер стадий — в `run.ts` (`StageTimings` в `PipelineResult`), отображение — строка `.verdict-timing` в verdict-card через чистый `formatTimings`. Пороги ТЗ остаются в «пикселях анализа» (даунскейл-пространство) — обратное масштабирование не вводим.

**Tech Stack:** Vite + vanilla TS (strict), Vitest (TDD для чистых функций), OpenCV.js + Tesseract.js WASM, Puppeteer QA (`pnpm qa`, шаги 1–17).

## Global Constraints

- Команды запускать как `cmd /c "pnpm <cmd> && echo PASS || echo FAIL"` (PowerShell даёт ложный код выхода у `pnpm.cmd`).
- **Один коммит на фичу**: красно-зелёные циклы Vitest НЕ коммитятся; в конце один `feat(polish): …` — subject only, одна строка, Conventional Commits, без тела.
- TS strict (`noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`), без `any`.
- Все пороги — константы `src/pipeline/constants.ts`, инлайн-числа запрещены.
- UI-копирайт русский; строки ТЗ — контракт (`[Status: Error] …`, `Ошибка: Угол ABC … 84.12°…`).
- Числа в UI — моноширинный `mono` + `tabular-nums`; цвета только через токены (CSS-переменные).
- Пайплайн-логика — чистые функции, без DOM/I/O внутри `src/pipeline/*`.
- QA-харнесс: колбэки `waitForFunction`/`evaluate` самодостаточны (замыкания Node не пробрасываются на страницу).

## File Structure

- Create `src/pipeline/scale.ts` + `src/pipeline/scale.spec.ts` — чистое решение о масштабировании.
- Modify `src/pipeline/constants.ts` — `MAX_IMAGE_DIMENSION`.
- Modify `src/pipeline/run.ts` (+ `run.spec.ts`) — замер стадий.
- Modify `src/ui/image-input.ts` — декод с даунскейлом + previewUrl.
- Modify `src/ui/types.ts` (+ create `src/ui/types.spec.ts`) — `AppState.raw`, `formatTimings`.
- Modify `src/ui/app.ts` — async onFile, «Проверить» без повторного декода, прокидывание timings.
- Modify `src/ui/verdict-card.ts` — строка timing.
- Modify `src/ui/upload-zone.ts` — актуальный hint; `src/ui/canvas-view.ts` — aria-атрибуты холста; `src/styles.css` — `:focus-visible` + `.verdict-timing`.
- Modify `scripts/qa/ui-shell.mjs` — шаги 10–16 (старые 10–12 перенумеровать в 13–17).
- Modify `README.md`, `context/build-plan.md`, `context/progress-tracker.md`, `context/ui-registry.md`, `memory.md`.

---

### Task 1: Даунскейл — константа + чистая функция (TDD)

**Files:**
- Modify: `src/pipeline/constants.ts`
- Create: `src/pipeline/scale.ts`, `src/pipeline/scale.spec.ts`

**Interfaces:**
- Produces: `scaledDimensions(width: number, height: number, maxDimension: number): { readonly width: number; readonly height: number }` и `downscaleRawImage(image: RawImage, maxDimension: number): RawImage` (Task 3 потребляет `scaledDimensions`); `MAX_IMAGE_DIMENSION = 1600`.

- [ ] **Step 1: failing test** — `src/pipeline/scale.spec.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { MAX_IMAGE_DIMENSION } from './constants';
import { downscaleRawImage, scaledDimensions } from './scale';

describe('scaledDimensions', () => {
  it('не увеличивает маленькое изображение', () => {
    expect(scaledDimensions(640, 300, MAX_IMAGE_DIMENSION)).toEqual({ width: 640, height: 300 });
  });
  it('альбомное большое → длинная сторона = max', () => {
    expect(scaledDimensions(4000, 3000, MAX_IMAGE_DIMENSION)).toEqual({ width: 1600, height: 1200 });
  });
  it('портретное большое → длинная сторона = max', () => {
    expect(scaledDimensions(1000, 3000, MAX_IMAGE_DIMENSION)).toEqual({ width: 533, height: 1600 });
  });
  it('пропорции сохраняются', () => {
    const s = scaledDimensions(3210, 1230, MAX_IMAGE_DIMENSION);
    expect(Math.abs(s.width / s.height - 3210 / 1230)).toBeLessThan(0.01);
  });
  it('граничный случай: не опускается ниже 1 px', () => {
    expect(scaledDimensions(5000, 4, 2)).toEqual({ width: 2, height: 1 });
  });
});

describe('downscaleRawImage', () => {
  it('nearest-neighbour: 4×2 → 2×1, берёт левые-верхние источники', () => {
    const src: RawImage = {
      width: 4,
      height: 2,
      data: new Uint8ClampedArray([
        10, 20, 30, 255, 40, 50, 60, 255, 70, 80, 90, 255, 100, 110, 120, 255,
        130, 140, 150, 255, 160, 170, 180, 255, 190, 200, 210, 255, 220, 230, 240, 255,
      ]),
    };
    const out = downscaleRawImage(src, 2);
    expect(out.width).toBe(2);
    expect(out.height).toBe(1);
    expect(Array.from(out.data.slice(0, 8))).toEqual([10, 20, 30, 255, 70, 80, 90, 255]);
  });
});
```

- [ ] **Step 2: run → FAIL** — `cmd /c "pnpm vitest run src/pipeline/scale.spec.ts && echo PASS || echo FAIL"` (модуля `scale` нет).
- [ ] **Step 3: implement** — в `constants.ts` в секцию CV-параметров добавить:

```ts
/** Максимальная сторона изображения для анализа: больше — даунскейл (бюджет ≤ 3 s, ТЗ §1). */
export const MAX_IMAGE_DIMENSION = 1600;
```

`src/pipeline/scale.ts` (полное содержимое):

```ts
/** Решение о даунскейле: чистая функция, без DOM. Пороги ТЗ применяются в масштабе анализа. */
import type { RawImage } from './lines';

export interface ImageDimensions {
  readonly width: number;
  readonly height: number;
}

/** Целевые размеры: upscale запрещён; длинная сторона сжимается до maxDimension. */
export function scaledDimensions(
  width: number,
  height: number,
  maxDimension: number,
): ImageDimensions {
  const longest = Math.max(width, height);
  if (longest <= maxDimension || longest <= 0) {
    return { width, height };
  }
  const scale = maxDimension / longest;
  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale)),
  };
}

/** Даунскейл RawImage (nearest-neighbour) — для тестов и не-canvas-потребителей. */
export function downscaleRawImage(image: RawImage, maxDimension: number): RawImage {
  const target = scaledDimensions(image.width, image.height, maxDimension);
  if (target.width === image.width && target.height === image.height) {
    return image;
  }
  const data = new Uint8ClampedArray(target.width * target.height * 4);
  for (let y = 0; y < target.height; y++) {
    const sy = Math.min(image.height - 1, Math.floor((y * image.height) / target.height));
    for (let x = 0; x < target.width; x++) {
      const sx = Math.min(image.width - 1, Math.floor((x * image.width) / target.width));
      const src = (sy * image.width + sx) * 4;
      const dst = (y * target.width + x) * 4;
      data[dst] = image.data[src];
      data[dst + 1] = image.data[src + 1];
      data[dst + 2] = image.data[src + 2];
      data[dst + 3] = image.data[src + 3];
    }
  }
  return { width: target.width, height: target.height, data };
}
```

- [ ] **Step 4: run → PASS** (та же команда).
- [ ] **Step 5: полный набор зелёный** — `cmd /c "pnpm test && pnpm typecheck && pnpm lint && echo PASS || echo FAIL"`.

---

### Task 2: Замер стадий в `run.ts` (TDD)

**Files:**
- Modify: `src/pipeline/run.ts`, `src/pipeline/run.spec.ts`

**Interfaces:**
- Produces: `StageTimings { detect; recognize; graph; verify; total: number }` (мс); `PipelineResult.timings: StageTimings` (обязательное поле — Task 4 потребляет).

- [ ] **Step 1: failing tests** — добавить в `run.spec.ts` (имена фикстур `IMG/SEGMENTS/LABELS` взять из существующих тестов файла):

```ts
const delay = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms));

it('замеряет длительности стадий (DI)', async () => {
  const result = await analyzeDrawing(IMG, 'perpendicular', 3.0, {
    detectSegments: async () => {
      await delay(5);
      return SEGMENTS;
    },
    recognizeLabels: async () => {
      await delay(5);
      return LABELS;
    },
  });
  expect(result.timings.detect).toBeGreaterThanOrEqual(4);
  expect(result.timings.recognize).toBeGreaterThanOrEqual(4);
  expect(result.timings.graph).toBeGreaterThanOrEqual(0);
  expect(result.timings.verify).toBeGreaterThanOrEqual(0);
  expect(result.timings.total).toBeGreaterThanOrEqual(
    result.timings.detect + result.timings.recognize,
  );
});

it('пустая детекция: timings присутствуют (recognize = 0)', async () => {
  const result = await analyzeDrawing(IMG, 'perpendicular', 3.0, { detectSegments: async () => [] });
  expect(result.timings.recognize).toBe(0);
  expect(result.timings.total).toBeGreaterThanOrEqual(result.timings.detect);
});
```

- [ ] **Step 2: run → FAIL** — `cmd /c "pnpm vitest run src/pipeline/run.spec.ts && echo PASS || echo FAIL"` (поля `timings` нет).
- [ ] **Step 3: implement** — в `run.ts`:

```ts
/** Длительности стадий, мс (performance.now; бюджет ТЗ — весь анализ ≤ 3 s). */
export interface StageTimings {
  readonly detect: number;
  readonly recognize: number;
  readonly graph: number;
  readonly verify: number;
  readonly total: number;
}
```

В `PipelineResult` добавить `readonly timings: StageTimings;`. Тело `analyzeDrawing`:

```ts
  const t0 = performance.now();
  const detected = await detect(image);
  const detect = performance.now() - t0;
  const segments = deduplicateSegments(detected);
  if (segments.length === 0) {
    return {
      segments: [], labels: [], vertices: [], graph: {}, unboundLabels: [],
      verdict: emptyVerdict,
      timings: { detect, recognize: 0, graph: 0, verify: 0, total: performance.now() - t0 },
    };
  }
  const t1 = performance.now();
  const labels = await recognize(image);
  const recognize = performance.now() - t1;
  const t2 = performance.now();
  const graphResult = buildGraph(segments, labels);
  const graphMs = performance.now() - t2;
  const t3 = performance.now();
  const verdict = verify({ graph: graphResult.graph, rule, epsilon });
  const verifyMs = performance.now() - t3;
  return {
    segments, labels, vertices: graphResult.vertices, graph: graphResult.graph,
    unboundLabels: graphResult.unboundLabels, verdict,
    timings: { detect, recognize, graph: graphMs, verify: verifyMs, total: performance.now() - t0 },
  };
```

- [ ] **Step 4: run → PASS**; полный `pnpm test` зелёный.

---

### Task 3: Декод с даунскейлом + превью одного размера (UI-проводка)

**Files:**
- Modify: `src/ui/image-input.ts`, `src/ui/types.ts`, `src/ui/app.ts`

**Interfaces:**
- Consumes: `scaledDimensions`, `MAX_IMAGE_DIMENSION` (Task 1).
- Produces: `fileToRawImage(file: File, maxDimension?: number): Promise<DecodedImage>`, `DecodedImage { raw: RawImage; previewUrl: string }`; `AppState.raw: RawImage | null`.

- [ ] **Step 1: `image-input.ts`** — заменить содержимое:

```ts
import type { RawImage } from '../pipeline/lines';
import { MAX_IMAGE_DIMENSION } from '../pipeline/constants';
import { scaledDimensions } from '../pipeline/scale';

/** Результат декода: RawImage для пайплайна + превью-URL того же размера (оверлей совпадает). */
export interface DecodedImage {
  readonly raw: RawImage;
  readonly previewUrl: string;
}

/**
 * Декодирует файл в RawImage (RGBA) через createImageBitmap + canvas, сжимая до
 * MAX_IMAGE_DIMENSION по длинной стороне (бюджет ≤ 3 s). Превью кодируется из
 * того же canvas → размеры превью и анализа всегда равны. Бросает Error, если
 * декодировать не удалось (app.ts показывает мягкую ошибку).
 */
export async function fileToRawImage(
  file: File,
  maxDimension = MAX_IMAGE_DIMENSION,
): Promise<DecodedImage> {
  const bitmap = await createImageBitmap(file);
  const target = scaledDimensions(bitmap.width, bitmap.height, maxDimension);
  const canvas = document.createElement('canvas');
  canvas.width = target.width;
  canvas.height = target.height;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) {
    bitmap.close();
    throw new Error('Не удалось создать контекст холста');
  }
  ctx.drawImage(bitmap, 0, 0, target.width, target.height);
  bitmap.close();
  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const blob = await new Promise<Blob>((resolve, reject) =>
    canvas.toBlob(
      (b) => (b ? resolve(b) : reject(new Error('Не удалось закодировать превью'))),
      'image/png',
    ),
  );
  return {
    raw: { width: imageData.width, height: imageData.height, data: imageData.data },
    previewUrl: URL.createObjectURL(blob),
  };
}
```

- [ ] **Step 2: `ui/types.ts`** — в `AppState` добавить поле `raw: RawImage | null;` (import type из `../pipeline/lines`, комментарий «Декодированное изображение для пайплайна (null — демо-режим)»); в `createInitialState` — `raw: null,`.
- [ ] **Step 3: `app.ts`** — `onFile` → async-декод с мягкой ошибкой (битое изображение не меняет state):

```ts
async function onFile(file: File): Promise<void> {
  const previous = state.imageUrl;
  try {
    const decoded = await fileToRawImage(file);
    if (previous) {
      URL.revokeObjectURL(previous);
    }
    state.analysis = null;
    update({ file, imageUrl: decoded.previewUrl, raw: decoded.raw });
    setVerdictPlaceholder(verdictCard, 'Изображение загружено. Нажмите «Проверить» для анализа.');
  } catch {
    setVerdictPlaceholder(verdictCard, '[Status: Error] Не удалось прочитать изображение');
  }
}
```

В `runPipeline`: `if (!state.raw || state.analyzing) return;` вместо проверки `state.file`, и `analyzeDrawing(state.raw, state.rule, state.epsilon)` (без `fileToRawImage` — декод уже сделан при загрузке). Остальное тело без изменений.

(`formatTimings` появится в Task 4 — задачи 3 и 4 выполнять подряд до прогона гейтов.)
- [ ] **Step 4: verify** — `cmd /c "pnpm typecheck && echo PASS || echo FAIL"`; поведение проверяется live в Task 5 (QA).

---

### Task 4: Отображение времени анализа (TDD для форматтера)

**Files:**
- Create: `src/ui/types.spec.ts`
- Modify: `src/ui/types.ts`, `src/ui/verdict-card.ts`, `src/ui/app.ts`

**Interfaces:**
- Consumes: `PipelineResult.timings: StageTimings` (Task 2).
- Produces: `formatTimings(t: StageTimings): string` — формат `CV 0.34 с · OCR 1.21 с · всего 1.55 с` (QA-регекс `/всего ([0-9.]+) с/`); `updateVerdictCard(card, verdict, notes?, timing?)`.

- [ ] **Step 1: failing test** — `src/ui/types.spec.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { formatTimings } from './types';

describe('formatTimings', () => {
  it('стадии и total в секундах, 2 знака', () => {
    expect(
      formatTimings({ detect: 340.4, recognize: 1210.9, graph: 0.2, verify: 0.1, total: 1551.6 }),
    ).toBe('CV 0.34 с · OCR 1.21 с · всего 1.55 с');
  });
});
```

- [ ] **Step 2: run → FAIL** — `cmd /c "pnpm vitest run src/ui/types.spec.ts && echo PASS || echo FAIL"`.
- [ ] **Step 3: implement.** В `ui/types.ts`:

```ts
import type { StageTimings } from '../pipeline/run';

/** Строка времени анализа для verdict-card (tabular-nums задаёт CSS). */
export function formatTimings(t: StageTimings): string {
  const sec = (ms: number): string => (ms / 1000).toFixed(2);
  return `CV ${sec(t.detect)} с · OCR ${sec(t.recognize)} с · всего ${sec(t.total)} с`;
}
```

`verdict-card.ts`: сигнатура `updateVerdictCard(card, verdict, notes: readonly string[] = [], timing?: string)`; после `meta` в массив `children`:

```ts
  if (timing) {
    children.push(paragraph('verdict-timing mono', timing));
  }
```

`app.ts`: `applyVerdict(verdict, notes, timing?)` → `updateVerdictCard(verdictCard, verdict, notes, timing)`; в `runPipeline` — `applyVerdict(analysis.verdict, softNotes(analysis.unboundLabels), formatTimings(analysis.timings))`; в `refreshVerdict` — третий аргумент `formatTimings(state.analysis.timings)` (стадии не перезапускаются — показываем времена последнего полного анализа).

- [ ] **Step 4: PASS** — `cmd /c "pnpm test && pnpm typecheck && pnpm lint && echo PASS || echo FAIL"`.

---

### Task 5: a11y-проход + QA-шаги 10–16 (live-верификация)

**Files:**
- Modify: `src/ui/canvas-view.ts`, `src/styles.css`, `src/ui/upload-zone.ts`, `scripts/qa/ui-shell.mjs`

- [ ] **Step 1: a11y-правки.** `canvas-view.ts`, в `createCanvasCard` после `canvas.id = ...`:

```ts
canvas.setAttribute('role', 'img');
canvas.setAttribute(
  'aria-label',
  'Чертёж: предпросмотр изображения с оверлеем распознанных отрезков, вершин и меток',
);
```

`styles.css` — проверить и добавить при отсутствии:

```css
:focus-visible {
  outline: 2px solid var(--color-accent);
  outline-offset: 2px;
}

.verdict-timing {
  font-variant-numeric: tabular-nums;
  color: var(--color-ink-2);
}
```

(имена токенов сверить с существующими в `src/styles.css`; моно-шрифт даёт класс `mono`, уже добавленный в разметке Task 4).

- [ ] **Step 2: upload hint.** `upload-zone.ts` — заменить устаревший текст (упоминание «Фазы 1» неактуально):

```ts
hint.textContent = 'PNG, JPEG, WEBP — изображения больше 1600 px сжимаются автоматически';
```

- [ ] **Step 3: QA-шаги.** В `ui-shell.mjs` после шага 9 вставить шаги 10–12 и 15; старые комментарии 10/11/12 перенумеровать в 13/14/17:

```js
// 10. Даунскейл: большой чертёж (3200×2400 → 1600×1200) проходит полный пайплайн.
const bigPng = await page.evaluate(async () => {
  const c = document.createElement('canvas');
  c.width = 3200; c.height = 2400;
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, 3200, 2400);
  ctx.strokeStyle = '#b0b0b0'; ctx.lineWidth = 20; ctx.lineCap = 'round';
  const seg = (x1, y1, x2, y2) => { ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke(); };
  seg(1000, 300, 2600, 300);
  seg(2600, 300, 2600, 1800);
  ctx.fillStyle = '#000000'; ctx.font = '700 128px Arial';
  ctx.fillText('A', 805, 355);
  ctx.fillText('B', 2645, 355);
  ctx.fillText('C', 2645, 1855);
  const blob = await new Promise((r) => c.toBlob(r, 'image/png'));
  return Array.from(new Uint8Array(await blob.arrayBuffer()));
});
await page.evaluate((bytes) => {
  const file = new File([new Uint8Array(bytes)], 'big.png', { type: 'image/png' });
  const dt = new DataTransfer(); dt.items.add(file);
  document
    .querySelector('.upload-zone')
    .dispatchEvent(new DragEvent('drop', { bubbles: true, cancelable: true, dataTransfer: dt }));
}, bigPng);
await page.click('.btn-primary');
await page.waitForFunction(() => document.querySelector('.badge')?.textContent === 'Верно', {
  timeout: 120000,
});
check('даунскейл 3200×2400 → 1600×1200: ∠ABC = 90° → Success', true);

// 11. Бюджет ≤ 3 s: строка timings в вердикте.
const timingText = await page.$eval('.verdict-timing', (el) => el.textContent);
const totalSec = Number(timingText.match(/всего ([0-9.]+) с/)?.[1] ?? NaN);
check('бюджет: полный анализ ≤ 3 s (строка timings)', Number.isFinite(totalSec) && totalSec <= 3.0);

// 12. Битое изображение → мягкая ошибка чтения (не падение).
await page.evaluate(() => {
  const file = new File([new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0, 1, 2, 3])], 'broken.png', {
    type: 'image/png',
  });
  const dt = new DataTransfer(); dt.items.add(file);
  document
    .querySelector('.upload-zone')
    .dispatchEvent(new DragEvent('drop', { bubbles: true, cancelable: true, dataTransfer: dt }));
});
await page.waitForFunction(() =>
  document.querySelector('.verdict-empty')?.textContent.includes('Не удалось прочитать изображение'),
);
check('битое изображение: мягкая ошибка «Не удалось прочитать изображение»', true);
```

И после перенумерованного шага 14 (пустой чертёж):

```js
// 15. A11y-инварианты: доступные имена и клавиатура.
const a11y = await page.evaluate(() => {
  const zone = document.querySelector('.upload-zone');
  const canvas = document.querySelector('#drawing-canvas');
  return {
    zoneRole: zone?.getAttribute('role') === 'button' && zone?.tabIndex === 0,
    ruleInLabel: document.querySelectorAll('label.field #rule-select').length === 1,
    epsInLabel: document.querySelectorAll('label.field #eps-range').length === 1,
    canvasAria:
      canvas?.getAttribute('role') === 'img' &&
      (canvas?.getAttribute('aria-label') ?? '').length > 0,
  };
});
check(
  'a11y: upload role=button/tabindex, поля внутри label, canvas role=img + aria-label',
  a11y.zoneRole && a11y.ruleInLabel && a11y.epsInLabel && a11y.canvasAria,
);
```

Перенумерация: старый шаг 10 (parallel soft-error) → 13; шаг 11 (пустой чертёж) → 14; шаг 12 (консоль) → 17.
- [ ] **Step 4: живой прогон** — `cmd /c "pnpm qa && echo PASS || echo FAIL"`; ожидание 17/17 PASS, консоль чистая.

---

### Task 6: README + контекст-доки + финальный коммит

**Files:**
- Modify: `README.md`, `context/build-plan.md`, `context/progress-tracker.md`, `context/ui-registry.md`, `memory.md`

- [ ] **Step 1: README.** Точечные правки:
  - «Возможности»: добавить пункт «**Производительность** — изображения больше 1600 px по длинной стороне сжимаются перед анализом; время стадий показывается в вердикте; полный анализ ≤ 3 s на CPU».
  - Новый раздел после «Быстрый старт» — «OCR-дружелюбные чертежи»: метки — чёрные/тёмные латинские буквы (высота глифа ≥ 24 px), линии — светло-серые (например `#b0b0b0`: бинаризация OCR их отбрасывает, Canny детектирует), центр метки — не дальше 40 px от вершины (после даунскейла), штрихи меток короче 30 px.
  - Раздел «Структура»: в перечне `pipeline/` указать `types.ts constants.ts lines.ts dedup.ts ocr.ts graph.ts verify.ts run.ts scale.ts opencv-interop.ts`.
- [ ] **Step 2: контекст-доки.**
  - `context/build-plan.md`: в 07 добавить строку «**Done 2026-09-13** (даунскейл до `MAX_IMAGE_DIMENSION` 1600 + замер стадий `StageTimings` в `run.ts`, строка времени в verdict-card, декод с превью одного размера в `image-input.ts`, битое изображение → мягкая ошибка, a11y: canvas role=img, `:focus-visible`, QA 17/17)», чекбокс Phase Checklist.
  - `context/progress-tracker.md`: Current Status → Phase 5 завершена; `[x] 07` с одной строкой фактов; «Next»: финальная заливка на GitHub (опционально).
  - `context/ui-registry.md`: по образцу записи 06 добавить — `.verdict-timing mono` (строка времени анализа), обновлённый hint upload-zone, `role="img"` + aria-label холста, `:focus-visible` outline.
- [ ] **Step 3: gates** — `cmd /c "pnpm test && pnpm typecheck && pnpm lint && pnpm format:check && pnpm build && echo PASS || echo FAIL"`.
- [ ] **Step 4: `/remember save`** (Session 7 в `memory.md`), затем один коммит:

```bash
git add -A
git commit -m "feat(polish): performance budget with downscale, timing display, a11y and README"
```

- [ ] **Step 5: preview smoke** — QA из Task 5 уже гоняет собранный `dist/` через `vite preview`; отдельный ручной smoke не требуется. При желании: `cmd /c "pnpm preview"` и открыть http://localhost:4173.

---

## Self-Review (выполнено при написании)

- **Spec coverage:** бюджет ≤ 3 s → Tasks 1–3 (даунскейл) + Task 2 (замер) + QA-шаг 11; error/empty states → Task 3 Step 3 (битое изображение) + существующие мягкие ошибки (QA 13/14); a11y → Task 5; README → Task 6. Приёмка ТЗ §5 не регрессирует: шаги 5–9 QA остаются.
- **Placeholders:** нет — каждый шаг содержит полный код/команду; «при отсутствии» относится только к idempotent CSS-токенам, имена сверяются с `src/styles.css` на месте.
- **Type consistency:** `StageTimings` (run.ts) → `formatTimings` (ui/types.ts) → `updateVerdictCard(…, timing?)` → QA-регекс `/всего ([0-9.]+) с/`; `scaledDimensions`/`MAX_IMAGE_DIMENSION` из Task 1 → `fileToRawImage` Task 3; `AppState.raw` Task 3 → `runPipeline` Task 3. Совпадает.

