# Memory — GeoCheck AI session log

Last updated: 2026-09-12 (Session 0)

## Session 0 — Initialization (scaffold + AI harness)

### What was built

- **Initialized `S:\web\geometry` as a standalone project «GeoCheck AI»** (модуль верификации геометрических чертежей; ТЗ — `product-brief.md` в корне).
- **Copied and adapted the AI-development harness from `cost-guard-ai`:** vendored skills (superpowers suite in `.agents/skills/`, task-observer in `.claude/skills/task-observer/`), `AGENTS.md`, `.clinerules`, `CLAUDE.md`, `skills-lock.json`, `context/*` (10 docs), `DESIGN.md`, `PRODUCT.md`, `README.md`, `memory.md`, `skill-observations/`.
- **Trimmed to a minimal school-project stack:** Vite + vanilla TypeScript SPA, browser-only (OpenCV.js + Tesseract.js WASM), Vitest TDD. No backend, no DB, no Tailwind, no monorepo, no GitHub Actions (GitHub — только финальная заливка).
- **Scaffolded a runnable Phase-0 skeleton:** `package.json`, `tsconfig.json`, `vite.config.ts`, `vitest.config.ts`, `index.html`, `src/main.ts`, `src/styles.css` (design tokens); pipeline core `src/pipeline/types.ts`, `constants.ts`, `verify.ts` + `verify.spec.ts` (4 правила геометрии + мягкие ошибки, TDD). Gates green: `pnpm test`, `pnpm typecheck`, `pnpm build`.

### Decisions made

- **Stack:** Vite + TS vanilla SPA; CV = OpenCV.js (`@techstark/opencv-js`), OCR = Tesseract.js (WASM). Всё клиентское; деплой = статический `dist/`.
- **Харнес-скиллы:** взят суперпауэрс-набор (12) + task-observer; Тейлвинд-скиллы и impeccable **удалены** (не нужны без Tailwind), `skills-lock.json` переписан.
- **Дизайн «Чертёжная доска»:** светлая тема, ink-синий акцент `#2563eb`, табулярные цифры — токены в `context/ui-tokens.md` (зеркало `DESIGN.md`).
- **UI-копирайт на русском; строки ТЗ — контракт:** мягкая ошибка `[Status: Error] Точка X не найдена на чертеже`, фейл `Ошибка: Угол ABC на рисунке равен 84.12°, отклонение составляет 5.88°`.
- **Пайплайн = чистые функции** в `src/pipeline/`, пороги — константы (`constants.ts`): 30 px, 5°, 7 px, 40 px, ε=3.0.

### Problems solved

- PowerShell блокирует `pnpm.ps1` → везде использовать `pnpm.cmd`.
- AGENTS.md/большие доки переваливали лимит editor → разбивка через маркер/insert_line.
- pnpm 11 блокирует build-скрипты; у tesseract.js это безобидный `opencollective-postinstall || true` → разрешён в `pnpm-workspace.yaml` (`allowBuilds`).
- oxlint 1.82: конфиг должен называться **`.oxlintrc.json`** (не `oxlint.json`) — иначе `ignorePatterns` не применялся при discovery и vendored-скиллы (`.agents/`, `.claude/`) попадали в линт (15 warning'ов на чужих скриптах). После переименования: 0 warnings.
- Prettier: `product-brief.md` (ТЗ) и vendored-скиллы исключены из проверки через `.prettierignore` — ТЗ не трогаем форматированием.

### Current state

- Фаза 0 (инициализация) завершена: `pnpm install` ок, `pnpm test`/`typecheck`/`lint`/`build` — зелёные (перепроверено при восстановлении сессии через `pnpm.cmd`).
- Сессия обрывалась ровно перед первым коммитом (git init + `git add` уже были сделаны); восстановлено: гейты перепроверены, первый коммит выполнен — см. `git log`.
- Фаза 1 (UI-шелл) ещё не начата — см. `context/build-plan.md`.

### Next session starts with

- **Phase 1 — 01 UI-shell:** drag-and-drop загрузка, список правил, слайдер ε, холст с mock-чертежом, панель вердикта (с mock-данными пайплайна → визуальная проверка → затем прожиг логики).

### Open questions

- Tesseract.js: локальный бандл `tessdata` vs CDN — решить на фазе 04 (OCR).