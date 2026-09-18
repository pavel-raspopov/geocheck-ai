# Feature 13 «Live QA + доки» Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Close Phase 6 — one combined QA command (`qa:all`), README rewritten for the v2 text→rules flow, honest ε=10 corpus documentation, final phase commit.

**Architecture:** No pipeline/UI code changes. This feature is tooling + docs only: a new npm script chaining the two existing headless suites, and a README that describes the actual v2 flow (textarea → offline parser → preview → confirm → checklist; Gemini fallback manual). The only conditional code change (AbortController in the Gemini fallback) is explicitly deferred until the live CORS check with the user's real key — out of scope here.

**Tech Stack:** pnpm scripts, Markdown docs, existing puppeteer suites (`scripts/qa/ui-shell.mjs`, `scripts/qa/testdata.mjs`).

## Global Constraints

- Vanilla TS + Vite SPA only; no new dependencies.
- UI copy and README in Russian; ТЗ message strings are contract.
- No secrets in tracked files — the Gemini API key lives only in the user's browser (localStorage `geocheck.gemini-api-key`).
- Windows PowerShell pitfalls (from skill-observations): run gates as `cmd /c "pnpm <cmd> && echo PASS || echo FAIL"`; never `2>&1` native commands; edit cyrillic files only with the editor tool (not PowerShell `Set-Content`).
- Verification ladder: `pnpm test` → `typecheck` → `lint` → `format:check` → `build` → `pnpm qa:all`.
- One commit per feature, subject-only, single line, Conventional Commits, English.
- Files touched: `package.json`, `README.md`, `context/build-plan.md`, `context/progress-tracker.md`, `context/ui-registry.md` (verify only — likely no change), `memory.md`, this plan.

---

### Task 1: `qa:all` script

**Files:**
- Modify: `package.json` (scripts block)

**Interfaces:**
- Produces: `pnpm qa:all` = build → ui-shell suite → testdata corpus suite. Fails fast (both `node` calls are sequential `&&`).

- [ ] **Step 1: Add the script** (editor tool):

In `package.json`, after the `"qa:testdata"` line add:

```json
    "qa:all": "pnpm build && node scripts/qa/ui-shell.mjs && node scripts/qa/testdata.mjs",
```

- [ ] **Step 2: Verify the script resolves** (fast check, no full run yet):

```powershell
cmd /c "pnpm run qa:all --help && echo PASS || echo FAIL"
```


### Task 2: README for the v2 flow

**Files:**
- Modify: `README.md`

**Content changes** (editor tool only — cyrillic):

1. **Header blurb (lines 3–5):** replace «загрузи чертёж, выбери правило, проверь условие» with the v2 flow: «загрузи чертёж, вставь текст задачи — правила распознаются автоматически, подтверди и получи вердикт». Extend the pipeline sentence: «текст задачи → оффлайн-парсер правил (основной путь) или Gemini (ручной фолбэк) → верификация ВСЕХ правил на графе чертежа».
2. **«Возможности» section:** rewrite to the v2 contract:
   - вход = изображение + текст задачи;
   - **текст → правила**: оффлайн-парсер (основной путь, TDD); предпросмотр правил; подтверждение пользователем (human-in-the-loop); при ошибке парсера — ручной фолбэк через Gemini (ключ вводится в UI, живёт только в localStorage);
   - **верификация всех правил** сразу: перпендикулярность, параллельность, равенство отрезков, принадлежность точки отрезку; погрешность ε (по умолчанию 3.0, ползунок);
   - keep детекция/дедупликация/OCR/граф bullets; drop the «≤ 3 s» performance claim (budget removed from ТЗ; refine-проход ~3–5 s is expected) → «Производительность — изображения > 1600 px сжимаются перед анализом; время стадий показывается в вердикте»;
   - мягкие ошибки bullet — extend with `[Status: Error] На чертеже не найдено отрезков`.
3. **New section «Как это работает: текст → правила → проверка»** (after «Быстрый старт»): 5-step flow (загрузка чертежа → текст задачи → предпросмотр правил → «Подтвердить и проверить» → чеклист с вердиктом по каждому правилу и общим итогом; ε-ползунок и смена текста пересчитывают без повторного OCR).
4. **New subsection «Честные ограничения»:** testdata-чертежи нарисованы неточно — acceptance-прогон `pnpm qa:testdata` выполняется при ε=10 (максимум ползунка); дефолт ТЗ 3.0 в UI не менялся; **абсолютные длины отрезков не верифицируются**; полный анализ ~3–5 s на CPU (refine-проход OCR).
5. **«Быстрый старт» commands:** add `pnpm qa`, `pnpm qa:testdata`, `pnpm qa:all` lines with one-line comments.
6. **«Структура» listing:** update `pipeline/` line to include `rules/`, `ocr-prep.ts`, `ocr-refine.ts`; add `scripts/qa/` line.

### Task 3: Verification ladder

- [ ] **Step 1: Gates**

```powershell
cmd /c "pnpm test && echo PASS || echo FAIL"        # 157/157
cmd /c "pnpm typecheck && echo PASS || echo FAIL"   # no errors
cmd /c "pnpm lint && echo PASS || echo FAIL"        # 0/0
cmd /c "pnpm format:check && echo PASS || echo FAIL"
```

README/package.json changes don't affect unit tests — gates must be green without code changes.

- [ ] **Step 2: Full QA chain (the new deliverable)**

```powershell
cmd /c "pnpm run qa:all && echo PASS || echo FAIL"
```

Expected: build ok → ui-shell 19/19 → testdata 4/4 (ε=10; corpus lives at slider max, bisector slack ~0.5 px — if link 1 flakes, rerun once before diagnosing).

- [ ] **Step 3: Preview smoke of `dist/`**: `pnpm preview` → open http://localhost:4173, verify textarea seeded, preview shows 4 rules, confirm → checklist.

### Task 4: Gemini live CORS check — manual, user-driven (not automated)

**Files:** none (probe `scripts/qa/gemini-cors-probe.mjs` exists; no key ever enters the repo).

- [ ] **Step 1:** User runs `pnpm dev`/`pnpm preview`, pastes their real Gemini API key into the fallback `<details>` field, enters unparseable task text to open the fallback, clicks «Уточнить через ИИ».
- [ ] **Step 2:** Outcomes: (a) completes → CORS confirmed; (b) hangs > 60 s → follow-up AbortController in `gemini.ts` (TDD, separate commit). Record outcome in `memory.md`.

### Task 5: Docs + memory + final Phase-6 commit

**Files:**
- Modify: `context/build-plan.md` (mark 13 done, one-line summary)
- Modify: `context/progress-tracker.md` (Phase 6 → завершена)
- Verify: `context/ui-registry.md` (no UI change — should already match)
- Modify: `memory.md` (via `/remember save` — Session 14 entry)

- [ ] **Step 1:** build-plan 13 → `- [x] 13 Live QA + доки (Phase 6) (Done 2026-09-18: qa:all …)`.
- [ ] **Step 2:** progress-tracker: Phase 6 complete; next = финальная заливка на GitHub, опционально ε-стабилизация.
- [ ] **Step 3:** `/remember save` (Session 14).
- [ ] **Step 4:** Single commit (subject only):

```bash
git add package.json README.md context/build-plan.md context/progress-tracker.md memory.md docs/superpowers/plans/2026-09-18-live-qa-docs.md
git commit -m "feat(qa): live QA + docs for text-to-rules flow (Phase 6 close)"
```

## Out of scope (deferred, logged)

- AbortController in `gemini.ts` — after Task 4 confirms the hanging fetch.
- ε-стабилизация (bisector 9.48 vs 10 margin) — open question, no code change.

Expected: no "Missing script" error. (Full run happens in Task 3.)
