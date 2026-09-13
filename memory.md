# Memory — GeoCheck AI session log

Last updated: 2026-09-13 (Session 4)

## Session 4 — Phase 3: 04 OCR (Tesseract.js)

### What was built

- **Фича 04 «OCR» реализована по TDD.** План: `docs/superpowers/plans/2026-09-13-ocr.md`. Спайк перед планом: проверены `node_modules/tesseract.js@7.0.0` (createWorker/loadImage/setImage/dump/getCore) и `tesseract.js-core@7.0.0`.
- **`src/pipeline/ocr.ts`** (+ spec, 9 тестов, red→green): `encodeBmp(image: RawImage): Uint8Array` — чистый кодировщик RGBA→BMP 24bpp (v7 `loadImage` НЕ принимает сырые пиксели; воркер ловит BMP по magic 'BM' и ре-кодирует через bmp-js); `extractLabels(page: OcrPage): Label[]` — чистый пост-фильтр (uppercase, строгий [A-Z], conf ≥ `OCR_MIN_CONFIDENCE`=60, центр bbox, порядок cy↑/cx↑); `recognizeLabels(image, overrides?)` — ленивый `import('tesseract.js')`, воркер кэшируется на модуль (аналог `cvPromise`), PSM '11' sparse, `cacheMethod:'none'`.
- **Оффлайн-bundle (решён открытый вопрос: локальный bundle вместо CDN):** `public/tessdata/eng.traineddata.gz` (~3 MB, `@tesseract.js-data/eng/4.0.0_best_int`) + `public/tesseract/` (`worker.min.js` + 3 LSTM-core варианта, ~20.4 MB). Node/Vitest: ядро и воркер из node_modules (`workerPath`/`corePath` НЕ задавать!), только `langPath: 'public/tessdata'`; браузер: `/tessdata`, `/tesseract/worker.min.js`, `/tesseract`.
- **Константы** в `constants.ts` (не из ТЗ): `OCR_LANG`, `OCR_CHAR_WHITELIST`, `OCR_MIN_CONFIDENCE=60`, `OCR_PSM='11'`, `OCR_USER_DPI='96'`.
- `.prettierignore` += `public/` (prettier переформатировал vendored `worker.min.js`/`*.wasm.js` — восстановлены байт-в-байт из node_modules).

### Decisions made

- **tessdata = локальный bundle, не CDN** (выбор пользователя): полностью оффлайн, детерминированные тесты/деплой; цена ~23 MB в `public/`. Открытый вопрос из сессий 0–3 закрыт.
- **`oem` = дефолтный LSTM_ONLY; whitelist не работает в LSTM** → строгий `[A-Z]`-фильтр обязателен в нашем коде (соответствует ТЗ «автоприведение к UPPERCASE»).
- **Output запрашивать явно:** дефолт v7 `recognize` = только `{text:true}`; для bbox нужен `{blocks:true,text:false}` (JSON-дерево `GetJSONText()`).
- Extraction устойчив: символы с приоритетом, fallback на word-уровень (если LSTM-only core не отдаёт symbols).

### Problems solved

- Спайк предотвратил неверный план: library-docs утверждал API `createTesseract` — на деле v7 = `createWorker(langs, oem, options)`; доки переписаны.
- Сырые пиксели (ImageData-подобный RawImage) воркер молча трактует как закодированные байты — нужен BMP-кодер (выбран BMP: без сжатия, magic-детект в `setImage`, работает в браузере и Node одинаково).
- Блочные диагональные глифы 5×7 (A, B, M) LSTM систематически misчитает (A→E, B→H, M теряется); осестойчивые (E, H, L) — читает стабильно → фикстуры интеграционного теста переведены на E/H/L (масштаб ×16, холст 640×200).
- TS strict после «зелёных» Vitest-тестов: генератор типизирован `Generator<OcrSymbolLike>` (word extends symbol), фикстуры `wordOf(...)` строят полноценные word-узлы.
- Prettier трогает vendored JS в `public/` → исключить каталог до `format`, восстанавливать файлы из node_modules при инциденте.

### Current state

- **Фаза 3 (04) завершена:** 41/41 юнит-тестов (интеграция на реальном WASM ~0.35 s), `typecheck`, `lint` 0/0, `format:check`, `build` — зелёные. Стадии по-прежнему не подключены к UI (Фаза 4/06); ocr в `dist/` tree-shaken.
- Обновлены: `context/library-docs.md` (Tesseract-раздел переписан по v7), `context/architecture.md` (стадия 3), `context/build-plan.md`, `context/progress-tracker.md`.

### Next session starts with

- **Фаза 3 — 05 Graph assembly:** `src/pipeline/graph.ts` — пересечения дедуплицированных отрезков → вершины; привязка каждой метки к ближайшей вершине ≤ 40 px (иначе drop/soft-note); вход — вывод `deduplicateSegments` + `recognizeLabels`; сначала `/writing-plans`. Не забыть `context/architecture.md` §граф и константу `LABEL_RADIUS`.
- После 05 — Фаза 4/06: подключение реального пайплайна к UI + acceptance-тесты ТЗ §5.

### Open questions

- Нет открытых. (Ранее: tessdata — решён: локальный bundle.)

## Session 3 — Phase 2: 03 Deduplication

### What was built

- **Фича 03 «Deduplication» реализована по TDD.** План: `docs/superpowers/plans/2026-09-13-deduplication.md`.
- **`src/pipeline/dedup.ts`** (+ spec, 10 тестов, red→green): `deduplicateSegments(): LineSegment[]` — чистая sync-функция (без OpenCV/DOM). Внутри: углы без направления ([0°, 180°), diff = min(|a−b|, 180−|a−b|)), метрика близости — минимум из 4 расстояний конец→отрезок, транзитивная кластеризация (union-find), слияние кластера по двум дальним концам, направление результата нормализовано (левее-выше первым), вывод — длина ↓ (конвенция lines.ts), ids `seg-N`.

### Decisions made

- **«Евклидово расстояние ≤ 7 px» между отрезками = минимальное расстояние отрезок↔отрезок** (4 пары конец→отрезок; 0 при наложении). Коллинеарные фрагменты с зазором > 7 px НЕ сливаются (чтение ТЗ «расстояние между ними»); Hough-дубли (±2–3 px) и налегающие фрагменты сливаются. Зафиксировано в `context/architecture.md`.
- Кластеризация транзитивна: A~B, B~C ⇒ один кластер даже при A!~C (union-find, детерминирован порядком входа).
- Пороги только из `constants.ts` (`CLUSTER_ANGLE_DEG=5`, `CLUSTER_DISTANCE=7`) — в тестах не литералы.

### Problems solved

- Конструкция угловых тестов: наклон θ задаётся `dy = dx·tan(θ)`, а не `2·tan(θ)` — иначе фактический угол ≈ 0.14° и тест «не сливаются» падал.
- `noUncheckedIndexedAccess` в спеках: `result[0]` требует `!` (`merged`/`prev`/`curr`).
- PowerShell: `cmd /c` требует цитировать весь аргумент (`cmd /c "pnpm.cmd test && echo PASS"`), иначе `&&` парсится самим PowerShell (дополнение к observation #2 в task-observer).
- Prettier: новые файлы прогонять через `--write` до `format:check`.

### Current state

- **Фаза 2 (02, 03) завершена:** 32/32 юнит-тестов, `typecheck`, `lint` 0/0, `format:check`, `build` — зелёные. Стадии не подключены к UI (подключение — Фаза 4/06), dedup в `dist/` tree-shaken.
- Обновлены: `context/progress-tracker.md`, `context/build-plan.md`, `context/architecture.md` (стадия 2 — метрика и транзитивность).

### Next session starts with

- **Фаза 3 — 04 OCR:** `src/pipeline/ocr.ts` (Tesseract.js, одиночные латинские A–Z uppercase + центры). Сначала решить открытый вопрос: локальный бандл `tessdata` vs CDN; перед стартом читать `context/library-docs.md`.
- Входной случай для 05 (graph): дедуплицированные отрезки из `deduplicateSegments`.

### Open questions

- Tesseract.js: локальный бандл `tessdata` vs CDN — решить на фазе 04 (OCR).

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