# Memory — GeoCheck AI session log

Last updated: 2026-09-12 (Session 2)

## Session 2 — Phase 2: 02 Line detection (OpenCV.js)

### What was built

- **Фича 02 «Line detection» реализована по TDD.** План: `docs/superpowers/plans/2026-09-12-line-detection.md`.
- **`src/pipeline/lines.ts`** (+ spec, 6 тестов, red→green): `RawImage` (структурный аналог ImageData, без DOM-типов) → `detectSegments(): Promise<LineSegment[]>`; внутри `cv.matFromArray(CV_8UC4)` → `cvtColor(COLOR_RGBA2GRAY)` → `Canny(50,150)` → `HoughLinesP` → фильтр ≥ `MIN_SEGMENT_LENGTH`; детерминированная сортировка (длина ↓) и id `seg-N`; `try/finally` с `.delete()` всех Mat.
- **`src/pipeline/constants.ts`**: добавлены не-ТЗ константы Canny/Hough (`CANNY_LOW=50`, `CANNY_HIGH=150`, `HOUGH_THRESHOLD=30`, `HOUGH_MAX_GAP=8`).
- **`vitest.config.ts`**: `test.server.deps.inline: ['@techstark/opencv-js']` + `test.deps.interopDefault: false`.

### Decisions made

- **Canny обязателен перед HoughLinesP**: Hough считает непустые пиксели точками-кандидатами; на чёрно-белом чертеже белый фон «заливает» аккумулятор (симптом: сотни диагоналей ±45°). Зафиксировано в `library-docs.md` и комментарии в `lines.ts`.
- Загрузка cv — README-паттерн (default-interop UMD) + **race-safe ожидание WASM** (`onRuntimeInitialized` может уже отработать → опрос `cv.Mat` каждые 50 мс).
- Тесты — property-based на синтетике (Брезенхэм толщиной 3), не на точных координатах: Hough не даёт бит-точных концов.

### Problems solved

- **Vitest × opencv-js UMD:** `await import('@techstark/opencv-js')` в Vitest падал мгновенно с `TypeError: Method Promise.prototype.then called on incompatible receiver [object Module]`. Причина: interop Vitest-оценщика (`interopModule`) дергает `.then` на namespace. Лечится **двумя** ключами под `test`: `server.deps.inline` + `deps.interopDefault: false`; на корневом уровне конфига ключи молча игнорируются (потрачено несколько итераций).
- Отладочный ход: смоук в plain Node (`scripts/tmp-*.mjs`, удалены) показал, что динамический import в Node работает, а ломается только Vitest-interop — локализовало проблему.
- Вывод результата HoughLinesP: `rows=1`, `cols=N`, `CV_32SC4`; `data32S` читается четвёрками (x1,y1,x2,y2) — не rows×1, как в классическом C++ API.

### Current state

- **Фаза 2 (02) завершена:** 22/22 юнит-тестов, `typecheck`, `lint` 0/0, `format:check`, `build` — зелёные. Стадия ещё не подключена к UI (подключение — Фаза 4/06), в `dist/` tree-shaken.
- Обновлены: `context/progress-tracker.md`, `context/build-plan.md`, `context/architecture.md` (стадия 1: + Canny), `context/library-docs.md` (полная секция OpenCV.js с проверенным паттерном).

### Next session starts with

- **Фаза 2 — 03 Deduplication:** `src/pipeline/dedup.ts` по TDD (кластеризация: Δугла ≤ 5° И расстояние ≤ 7 px; слияние кластера в один отрезок по двум дальним концам; детерминированные тесты — чистый TS, без OpenCV).
- Возможный подвох: у отрезков-дублей после Hough толщина даёт ~2 параллельных сегмента (±2 px) — это входной случай 03.

### Open questions

- Tesseract.js: локальный бандл `tessdata` vs CDN — решить на фазе 04 (OCR).

## Session 1 — Phase 1 UI shell (build-plan 01)

### What was built

- **Feature 01 (Phase 1 — UI Shell) реализован полностью на mock-данных.** План фичи: `docs/superpowers/plans/2026-09-12-ui-shell.md`.
- **`src/mock/demo-drawings.ts`** (+ spec, 6 тестов, TDD red→green): идеальная сцена A(300,100), B(300,320), C(520,320), D(520,100), M — середина AB (все 4 правила Success при ε=3); сцена с отклонениями — BC повёрнут на −5.88° вокруг B (∠ABC = 84.12°, точный текст ТЗ) и M(300,340) за точкой B (Fail point-on-segment).
- **UI-компоненты в `src/ui/`**: `types.ts` (RULE_OPTIONS с русскими подписями, EPS_MIN/MAX/STEP = 0.5/10/0.5, AppState, formatEpsilon), `upload-zone.ts` (DnD + скрытый input + клавиатура + ошибка для не-изображения), `rule-select.ts`, `epsilon-slider.ts` (`<output class="mono">`), `canvas-view.ts` (DPR-масштаб, шахматка, вписывание 800×600, оверлей: сегменты accent/вершины ink-3/метки info), `verdict-badge.ts`, `verdict-card.ts` (aria-live), `app.ts` (`createApp`: топбар со статус-точкой → карточка холста с upload-зоной → контролы («Проверить») → карточка вердикта).
- **`main.ts`** переписан на `createApp(app)`; `styles.css` дополнен токен-only стилями; `.gitkeep` в `src/ui` и `src/mock` удалены.
- **QA-харнесс живой проверки `scripts/qa/ui-shell.mjs` (`pnpm qa`):** puppeteer (dev-only) + headless **system Chrome** (`channel: 'chrome'`, Chromium-загрузка пропущена через `allowBuilds: puppeteer: false` + `ignoredBuiltDependencies`); сам поднимает `vite preview` для `dist/`; 9 проверок (топбар, авто-вердикт, чернила на холсте, смена правила, точный текст ТЗ при ε=3, флип Success при ε=6, кнопка «Проверить», мягкая ошибка для не-изображения, чистая консоль с фильтром favicon-404). Паттерн перенят из cost-guard-ai.

### Decisions made

- **Mock = демо-граф + настоящий `verify()`** (движок уже покрыт тестами): вердикт живо реагирует на правило и ε без CV/OCR; это и есть «mock pipeline result» Фазы 1.
- Вердикт пересчитывается автоматически при каждом изменении состояния + по кнопке «Проверить» (явный триггер станет обязательным с Фазы 4, когда вычисления станут тяжёлыми).
- Загруженное изображение в Фазе 1 — только превью (`URL.createObjectURL` + revoke предыдущего); анализ — после Фаз 2–4 (честная плашка в canvas-note).
- Бейдж и статус-точка: Success → «Верно»/ok; Fail|Error → «Ошибка»/danger.
- Цвета canvas читаются из CSS custom properties (`getComputedStyle`) — правило «только токены» соблюдено и в canvas (там нет разметки).
- **Коммит-сообщение — всегда одна строка** (subject Conventional Commits, без body); правило зафиксировано в `.clinerules` §4 и `context/code-standards.md`. Два коммита сессии переписаны в однострочные (`c35481d`, `9caa5ea`).

### Problems solved

- Параллельный запуск гейтов в одном вызове: `pnpm format --write` и `format:check` гонялись → ложный FAIL. Гейты запускать последовательно или только `cmd /c`-обёрткой.
- editor-замена с неполным old_text склеила строки в `verdict-card.ts` — починено повторным чтением файла и точечной правкой (всегда перечитывать файл после неожиданного diff).
- Обёртка `cmd /c "pnpm.cmd … && echo PASS || echo FAIL"` из Observation 2 применена ко всем гейтам — работает.
- **puppeteer QA:** `page.waitForFunction(fn, arg)` кладёт `arg` в *options* (второй параметр — options, аргументы только после `{}`) → тихий вечный undefined в колбэке; правильно `waitForFunction(fn, {}, arg)`. `pnpm add puppeteer` даёт `ERR_PNPM_IGNORED_BUILDS` (exit 1) и ломает последующие `pnpm`-скрипты через deps-check — лечится `allowBuilds: puppeteer: false` + `ignoredBuiltDependencies: [puppeteer]` в `pnpm-workspace.yaml` (Chromium не качаем — системный Chrome).
- Старый листенер на QA-порту легко спутать с багом приложения — при диагностике сначала `Get-NetTCPConnection -LocalPort <port>`.

### Current state

- **Фаза 1 (01) завершена полностью, включая живую проверку:** юнит 16/16, `typecheck`, `lint` 0/0, `format:check`, `build`; headless Chrome QA — **9/9** (`pnpm qa`, system Chrome, `dist/` preview).
- `context/progress-tracker.md`, `context/ui-registry.md` (все компоненты shipped + Patterns от `/imprint`), `context/build-plan.md` (чеклист), `context/library-docs.md` (секция Puppeteer) обновлены.

### Next session starts with

- **Фаза 2 — 02 Line detection (OpenCV.js):** `src/pipeline/lines.ts` по TDD (grayscale → HoughLinesP → фильтр < 30 px → `LineSegment[]`), ленивый `await import('@techstark/opencv-js')`; перед стартом прочитать `context/library-docs.md`.
- Новый UI в Фазах 2–4 дополнять проверками в `scripts/qa/ui-shell.mjs` (харнесс уже поднимает сервер и браузер).

### Open questions

- Tesseract.js: локальный бандл `tessdata` vs CDN — решить на фазе 04 (OCR).


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