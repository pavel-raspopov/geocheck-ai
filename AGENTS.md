---
description: Instructions for building GeoCheck AI with AI agents
globs: *
alwaysApply: true
---

## Context Efficiency & Sub-Agent Execution

1. **Targeted Context Loading:**
   - Do not read documentation files (`context/*`) "just in case".
   - Read UI/architecture rule files ONLY if the current subtask explicitly requires them.

2. **Session start — Task Observer:**
   - At the start of any task-oriented session (any interaction where you will use tools and produce deliverables), load `.claude/skills/task-observer/SKILL.md` and follow its Session Start Protocol **before** beginning work. This captures skill-improvement opportunities. Check the observation log for OPEN observations tagged to the skills you use and apply them.

3. **Concise Reporting:**
   - When returning results, provide a brief summary (3–5 bullets): what was done, which files changed, verification status.
   - Do not recap your entire thought process.

4. **Ban on Exhaustive Searches:**
   - If you cannot find a required file within 2–3 search attempts, stop and ask instead of scanning the entire repository.

## Read Before Anything Else

Read in this exact order before any implementation:

1. `context/project-brief.md`
2. `context/project-overview.md`
3. `context/architecture.md`
4. `context/ui-tokens.md`
5. `context/ui-rules.md`
6. `context/ui-registry.md`
7. `context/code-standards.md`
8. `context/library-docs.md`
9. `context/build-plan.md`
10. `context/progress-tracker.md`

`product-brief.md` (repo root) is the original Russian specification (ТЗ). `context/project-brief.md` is its agent-readable adaptation and the **single source of truth** for product requirements. Do not contradict them.

## Rules That Never Change

- **Pure pipeline only:** CV/OCR/graph/verify logic lives as pure functions in `src/pipeline/` (no DOM, no I/O) and is TDD-tested with Vitest. All geometric thresholds are centralized constants — 30 px min segment, 5° / 7 px cluster, 40 px label radius, ε = 3.0 default — never redefined inline.
- TypeScript **strict** stays ON (`noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`). No `any`; no untyped cross-module payloads.
- UI uses only design tokens from `context/ui-tokens.md` (canonical; mirror: root `DESIGN.md`). No raw hex in components.
- UI copy is Russian; the exact ТЗ strings are contract: soft error `[Status: Error] Точка X не найдена на чертеже`, fail text `Ошибка: Угол ABC на рисунке равен 84.12°, отклонение составляет 5.88°` (format contract, numbers dynamic).
- User-visible features are "done" only after live browser verification (see verification-before-completion) plus `pnpm test` + `pnpm typecheck` + `pnpm build` green.
- Update `context/progress-tracker.md` and `context/ui-registry.md` after every feature.
- Before any third-party library — read `context/library-docs.md`.
- If the same problem persists after one corrective prompt — stop immediately and run `/recover`.
- Browser-only: no backend, no database, no Docker. Deployment = static build (`pnpm build` → `dist/`). Keep it that way.

## Available Skills

Skills are installed in-repo (vendored) so any agent runtime (Cline, Claude Code, Codex, Cursor) can load them:

- **Superpowers suite:** `./.agents/skills/<name>/SKILL.md` — architect, brainstorming, writing-plans, executing-plans, test-driven-development, systematic-debugging, verification-before-completion, feature-review, recover, remember, imprint, using-superpowers. See `skills-lock.json` for pinned paths.
- **Task observer:** `./.claude/skills/task-observer/SKILL.md`.

### Using the skills (conventions)

- `/architect` — before any complex feature. Think before building.
- `/brainstorming` – before any new feature or UI. Explore requirements & design.
- `/writing-plans` – before implementing complex features. Create step-by-step specs → save under `docs/superpowers/plans/`.
- `/executing-plans` – when executing a step-by-step implementation plan.
- `/test-driven-development` – active from Phase 0 (Vitest wired). Use for all pipeline logic.
- `/systematic-debugging` – when facing bugs or test failures. Find root cause first.
- `/verification-before-completion` – before marking task complete. Test, build, and validate.
- `/feature-review` – the custom 3-layer review. Run before demo or when something feels off.
- `/recover` — when something breaks after one failed correction.
- `/remember save` — end of session **and always before a git commit** (writes `memory.md`, committed to git). `/remember restore` — when returning after a multi-session feature.
- `/task-observer` – optional session watcher for skill improvement observations.
- `/imprint` — after any new UI component. Capture patterns for `context/ui-registry.md`.

# Stack Overview

## What is GeoCheck AI?

GeoCheck AI automatically verifies whether a raster drawing matches a textual geometric condition (ТЗ). A browser-only SPA: upload a drawing, pick a rule, move the epsilon slider — the engine extracts line segments, deduplicates them, reads vertex labels with OCR, builds a graph, and checks geometric invariants.

## Stack (locked)

| Layer      | Tool                                              | Purpose                            |
| ---------- | ------------------------------------------------- | ---------------------------------- |
| App        | Vite + TypeScript (vanilla SPA)                   | Single-page UI, no framework       |
| CV         | OpenCV.js (`@techstark/opencv-js`, WASM)          | Line segment detection             |
| OCR        | Tesseract.js (WASM)                               | Single Latin letters A–Z + centers |
| Text→Rules | Оффлайн-парсер (pure TS) + Gemini REST (fallback) | Извлечение правил из текста задачи |
| Tests      | Vitest 4                                          | TDD on `src/pipeline/*`            |
| Quality    | TypeScript strict · oxlint · Prettier             | Local gates (`pnpm …`)             |
| Delivery   | `pnpm build` → static `dist/`                     | No server, no DB, no Docker        |

## Critical Rules

### Pipeline (stage order — ТЗ §2, ред. 2026-09-17)

1. **lines** — detect segments (min length 30 px)
2. **dedup** — cluster (angle diff ≤ 5°, distance ≤ 7 px), merge to the two farthest endpoints
3. **ocr** — single Latin letters A–Z, uppercase, center coordinates
4. **graph** — vertex = intersection of filtered segments; bind a letter to the nearest vertex ≤ 40 px
5. **text→rules** — оффлайн-парсер текста задачи → Rule-JSON (`src/pipeline/rules/`); Gemini REST — только ручной фолбэк с API key из UI
6. **confirm (human-in-the-loop)** — правила показываются пользователю; верификация только после явного подтверждения
7. **verify** — проверка ВСЕХ подтверждённых правил с ε (default 3.0): angle (любая мера), parallel, equal, on-segment, median, bisector, height

### Formulas (see `context/architecture.md`)

- Angle measure: `acos(dot(BA, BC) / (|BA|·|BC|))` — |angle − N| ≤ ε (N = 90 — perpendicularity)
- Parallel: `asin(|cross(AB, CD)| / (|AB|·|CD|))` ≤ ε
- Equal segments: `||AB| − |CD||` ≤ ε px
- Point on segment: `(AM + MB) − AB` ≤ ε px (triangle inequality puts M strictly between A and B)
- Median (BK→AC): on-segment(K, AC) + |AK − KC| ≤ ε px
- Bisector (BM∠ABC): |∠ABM − ∠MBC| ≤ ε°
- Height (BM→AC): BM ⊥ AC (≤ ε°) + foot on line AC

### Failure model

Missing label → soft error `[Status: Error] Точка X не найдена на чертеже` (no exceptions, no crashes). Invalid LLM output / пустой парсинг → мягкая ошибка, не падение.

### Important Notes (ТЗ ред. 2026-09-17)

- **Не решаем задачу, а проверяем чертёж.** Абсолютные длины («АС = 16 см») не верифицируются (нет масштаба см→px) — извлекаются как «дано».
- В текстах задач кириллические омоглифы (А/В/С/К/М…) — нормализация до парсинга и сопоставления с OCR.
- testdata/ (`N-text.txt` + `N-photo…-true|false.jpg`) — acceptance-корпус; парсер обязан покрыть обе задачи без ИИ.
- Дефолтного ключа в `.env` НЕТ (решение 2026-09-17); API key только через UI-поле фолбэка.

## Important Notes

- School/portfolio project: simplicity over scale. One package, no monorepo, no Tailwind, no Angular/NestJS (that stack belongs to a different project).
- Deleting/relocating skills or context files requires updating `skills-lock.json` + this file + `.clinerules`.
- GitHub is used only for the final upload; all work happens locally (local `git` repository initialized).
