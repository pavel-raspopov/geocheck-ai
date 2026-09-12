# Code Standards

Binding TypeScript/conventions for this repo. Violations are review blockers.

## Universal

- TypeScript **strict** (`strict`, `noUncheckedIndexedAccess: true`, `exactOptionalPropertyTypes: true`).
- Formatting: 2-space, single quotes, semicolons, 100 cols — Prettier enforced via `pnpm format:check`.
- Lint: **oxlint** (`pnpm lint`). Prettier for formatting.
- **No `any`; no untyped cross-module payloads.** Public pipeline API fully typed.
- Conventional commits: `feat:`, `fix:`, `chore:`, `test:`, `docs:`, `refactor:`, `build:`.
- Tests: **Vitest 4** co-located `*.spec.ts`; pipeline-target coverage ≥ 90%.

## Pipeline (`src/pipeline/`)

- **Pure functions only:** given inputs → outputs; no DOM, no I/O, no globals, no randomness. Deterministic → trivially testable.
- One module per stage: `types`, `constants`, `lines`, `dedup`, `ocr`, `graph`, `verify`.
- Thresholds live in `constants.ts` (ТЗ-sourced, never inline):
  `MIN_SEGMENT_LENGTH = 30`, `CLUSTER_ANGLE_DEG = 5`, `CLUSTER_DISTANCE = 7`, `LABEL_RADIUS = 40`, `EPS_DEFAULT = 3.0`, `MESSAGE_DECIMALS = 2`.
- Heavy WASM libs (OpenCV.js, Tesseract.js) are imported **lazily** inside async stage functions — never at module top level.
- Exact ТЗ message strings are contract (soft error, fail text formats) — keep them next to the formulas.

## UI (`src/main.ts`, `src/ui/`)

- No framework: plain TS functions + DOM. State = plain data; re-render on change (small app).
- Classes/styles only from CSS custom properties (`var(--color-*)`) — **no raw hex/rgb in markup or inline styles** (tokens: `context/ui-tokens.md`).
- All numbers (coordinates, ε) use `font-num` + `tabular-nums`.
- Russian UI copy; exact ТЗ strings are contract.
- A11y: labels on inputs, `:focus-visible` rings, `aria-live="polite"` on verdict changes.

## Process

- Update `context/progress-tracker.md` + `context/ui-registry.md` after every feature.
- `/remember save` before git commits (writes `memory.md`).
- One commit per feature (see `.clinerules` §4); commit message in English (`feat(scope): ...`).
- No `.env`, keys, or secrets in tracked files (browser-only app — none expected).
