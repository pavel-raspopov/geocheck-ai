# Plan — Feature 02: Line detection (`src/pipeline/lines.ts`)

Date: 2026-09-12 · Phase 2 · Approved in plan mode.

## Goal

Stage 1 of the ТЗ pipeline as a pure async function: RGBA bitmap → grayscale → Canny → `HoughLinesP` → filter segments < 30 px → `LineSegment[]`.

## Verified library API (smoke-tested in Node 22, `@techstark/opencv-js@5.0.0`)

- Default import may be a Promise or a module awaiting `onRuntimeInitialized` (README pattern, all three branches).
- `cv.matFromArray(height, width, cv.CV_8UC4, rgbaArray)` — flat interleaved RGBA, row-major.
- `cv.cvtColor(rgbaMat, grayMat, cv.COLOR_RGBA2GRAY)`.
- **`cv.Canny(gray, edges, 50, 150, 3, false)` is mandatory before Hough** — Hough treats every non-zero pixel as an edge point; on a black-lines-on-white drawing the white background floods the accumulator (symptom: only ±45° diagonals).
- `cv.HoughLinesP(edges, lines, 1, π/180, threshold, minLineLength, maxGap)`; result Mat: `rows=1, cols=N, CV_32SC4`; `lines.data32S` = N × (x1, y1, x2, y2) quads.
- Every intermediate `cv.Mat` must be `.delete()`ed (WASM heap).

## API

```ts
// src/pipeline/lines.ts
export interface RawImage {
  width: number;
  height: number;
  /** RGBA, 4 bytes/pixel, row-major (structurally like ImageData; no DOM types). */
  data: Uint8ClampedArray;
}
export async function detectSegments(image: RawImage): Promise<LineSegment[]>;
```

- Lazy `await import('@techstark/opencv-js')` inside the function (architecture rule).
- Hough tuning constants in `src/pipeline/constants.ts` (marked non-ТЗ): `CANNY_LOW/HIGH`, `HOUGH_THRESHOLD`, `HOUGH_MAX_GAP`; `minLineLength = MIN_SEGMENT_LENGTH` (ТЗ).
- Explicit post-filter `length ≥ MIN_SEGMENT_LENGTH` (safety, ТЗ §3.1).
- Deterministic ids (`seg-<index>` after a stable sort).

## TDD steps (Vitest, Node — verified workable)

1. Red: `src/pipeline/lines.spec.ts` — synthetic RGBA helpers (Bresenham, thickness 3):
   - long horizontal ≥ 30 px → detected, endpoints within ±3 px;
   - vertical + horizontal (rectangle sides) → both found;
   - diagonal line → found;
   - 20 px segment → filtered out;
   - blank image → `[]`, no throw;
   - invariant: every segment length ≥ `MIN_SEGMENT_LENGTH`; ids unique.
   Property assertions (not bit-exact endpoints); generous timeout for WASM load.
2. Green: implement `lines.ts` per API above.
3. Gates: `pnpm test` / `typecheck` / `lint` / `format:check` / `build` (sequential `cmd /c` wrappers).

## After green

- Record the verified WASM pattern + Canny gotcha in `context/library-docs.md`.
- Tick 02 in `context/build-plan.md` + `context/progress-tracker.md`.
- `/remember save`, single commit `feat(pipeline): line detection stage (OpenCV.js HoughLinesP)`.

## Non-goals

- No UI wiring (Phase 4), no dedup (03), no QA-harness changes (nothing user-visible changes).
