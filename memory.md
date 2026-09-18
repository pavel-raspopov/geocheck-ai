# Memory — GeoCheck AI session log

Last updated: 2026-09-18 (Session 14)


## Session 14 — Phase 6/13: Live QA + доки — фаза 6 закрыта (acceptance + QA зелёные)

### What was built

- **Фича 13 реализована: `pnpm qa:all`** = build → `scripts/qa/ui-shell.mjs` (19/19, новый text→confirm-флоу уже покрыт шагами 2/4/14a) → `scripts/qa/testdata.mjs` (4/4, ε=10). Один прогон обеих headless-сюит на `dist/`; `pnpm qa` оставлен быстрым (только ui-shell).
- README переписан под v2-флоу: блюр и «Возможности» (текст→правила через оффлайн-парсер, human-in-the-loop, Gemini-фолбэк с ключом только в localStorage, верификация всех правил); новые разделы «Как это работает: текст → правила → проверка» (5 шагов) и «Честные ограничения»; убрано устаревшее «полный анализ ≤ 3 s» (бюджет убран из ТЗ; refine ~3–5 s); «Структура» дополнена `pipeline/rules/`, `ocr-prep.ts`, `ocr-refine.ts`, `scripts/qa/`.
- `context/build-plan.md` (13 done), `context/progress-tracker.md` (Phase 6 завершена), план фичи `docs/superpowers/plans/2026-09-18-live-qa-docs.md`.

### Decisions made

- **`qa:all` — отдельная связка, а не расширение `pnpm qa`**: corpus-прогон медленный и ε=10-специфичен; быстрый `pnpm qa` сохранён как основной UX-гейт (решение пользователя).
- **AbortController отложен**: добавляется в `gemini.ts` только после живого CORS-чека, который подтвердит зависший fetch (решение пользователя; из песочницы egress заблокирован — см. Session 12).
- Гейты: `pnpm test` 157/157, typecheck, lint 0/0, format:check, build, `pnpm qa:all` — все зелёные на `dist/`.

### Problems solved

- `format:check` падал на `context/build-plan.md` при чистом git-статусе (коммит Session 13 прошёл без формат-гейта): prettier хотел пустую строку перед заголовком `### 13`. `prettier --write` выровнял (git-diff пуст — нормализация концов строк); рабочее правило: **после правки context/*.md всегда прогонять `prettier --check .` до коммита**.

### Current state

- **Phase 6 закрыта (фичи 11, 12, 13 done).** Все гейты зелёные; `qa:all` 19/19 + 4/4; ui-registry актуален (UI-модули не менялись). Финальный коммит фазы — следующий шаг этой сессии.

### Next session starts with

- **Живой CORS-чек Gemini**: пользователь открывает `pnpm dev`/`preview`, вводит реальный ключ в поле фолбэка, нечитаемый текст → «Уточнить через ИИ». Если fetch зависает >60 с — AbortController в `gemini.ts` (TDD, отдельный коммит).
- Опционально: ε-стабилизация (биссектриса задачи 1 = 9.48 при допуске 10 — корпус на грани).
- Финальная заливка на GitHub.

### Open questions

- Живой CORS-чек Gemini REST (реальная сеть + ключ пользователя) — исход не проверен.
- ε-запас 0.5 px: если правки сдвинут измерение, связка testdata 1 мигнёт.

### Appendix (same session) — попытка живого теста через Orca browser

- Dev-сервер поднят, приложение работает в Orca-вкладке; acceptance-связка 1 собрана удалённо: `orca upload --element e7 --files testdata/1-photo-true.jpg` (загрузка файла в инпут работает), текст из `testdata/1-text.txt` + ε=10 через `orca eval` (fetch `/@fs/…` + dispatch input — работает, кириллица без PowerShell-перекодировки).
- **Не работает: синтетические `orca click`** — события клика не долетают до страницы (combobox/кнопка не реагируют), при этом `snapshot`/`upload`/`eval` работают. С мобильного клиента Orca редактировать поля тоже нельзя. → Живой CORS-чек Gemini переносится на локальный ноутбук пользователя (ключ вставляет пользователь; сеть реальная).
- Инструкция пользователю для локального теста выдана: DevTools → Network (запрос к `generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent`, header `x-goog-api-key`) + Console (CORS/net-ошибки) + поведение кнопки фолбэка (busy → ответ/зависание).
- **Результат живого чека (2026-09-18, ноутбук пользователя): fetch завершился — CORS/сеть РАБОТАЮТ, зависания нет → AbortController НЕ нужен.** Но ответ был **404: «use models/gemini-3.6-flash»** — модель `gemini-2.0-flash` устарела. TDD-фикс: `GEMINI_URL` → `gemini-3.6-flash` (спека + `gemini.ts`), доки `library-docs.md`/`build-plan.md` обновлены. Пользователь перепроверит endpoint тем же способом после пуша.


## Session 13 — Phase 6/12: testdata-харнесс + калибровка пайплайна (acceptance 4/4)

### What was built

- **Фича 12 реализована: `pnpm qa:testdata` — 4/4 связок acceptance-корпуса зелёные** (текст+фото → вердикт совпадает с суффиксом; обе задачи парсятся оффлайн-парсером, фолбэк закрыт). Юниты 157/157, typecheck/lint/format/build зелёные, `pnpm qa` 19/19.
- `scripts/qa/testdata.mjs`: puppeteer-прогон 4 связок через `dist/` (vite preview + system Chrome); свежая страница на связку, текст из `N-text.txt` (UTF-8), проверка парсера + закрытого фолбэка, дроп фото (байты — plain Array, `Uint8Array` пересобирается в странице), ε=10 через ползунок, сверка `#verdict-region > .badge` с суффиксом. Консоль-шум фильтруется (favicon 404).
- **Калибровка пайплайна** (выявлена харнессом, три изменения):
  1. `ocr-prep.ts` (новый): `padAndUpscale` — белые поля 32 px + nearest-апскейл ×2 перед OCR; `recognizeLabels` маппит координаты обратно в оригинал. Чинит метки у края кадра и мелкие глифы (билинейное сглаживание ЛОМАЕТ tesseract — только nearest).
  2. `ocr-refine.ts` (новый): refine-проход PSM 10 для непомеченных вершин (пропуск в радиусе 2·LABEL_RADIUS от помеченных): тяжёлая маска отрезков (11 px) → центроид чернил → чтение символа с кропа лёгкой маски (3 px), conf ≥ 80. Дочитывает K/M/C, слитые с линиями чертежа. `run.ts` прогоняет refine → пересборка графа; `PipelineDeps.recognizeChar` для DI.
  3. `graph.ts`: пересечения поддерживающих прямых засчитываются в радиусе 26 px (`INTERSECTION_CORNER_TOLERANCE`) — углы чертежа точнее концов Hough; концы, где ОБА отрезка заканчиваются у общего угла (≤13 px, `ENDPOINT_MATCH_TOLERANCE`), отбрасываются как перелёт (одиночный конец у пересечения — засечка, сохраняется); кластеризация вершин — union-find (транзитивная) радиуса 12 вместо жадной rep-based.
- `scripts/qa/diag-pipeline.mjs` + `diag-runner.js`: диагностика пайплайна в браузере через vite dev (`--full` — реальный analyzeImage, `--refine` — зонд refine, дефолт — дамп стадий).
- `package.json`: скрипт `qa:testdata`.
- `scripts/qa/ui-shell.mjs`: шаг «бюджет ≤3 s» заменён на «timings измерены» — бюджет убран из ТЗ (brief §KPI), refine-проход его закономерно превышает (~3–5 s).
- Доки: build-plan 12 (done + детали калибровки), progress-tracker, план фичи `docs/superpowers/plans/2026-09-17-testdata-harness.md`.

### Decisions made

- **ε корпуса = 10 (максимум ползунка), дефолт ТЗ 3.0 в UI НЕ менялся.** Чертежи testdata нарисованы неточно: измеренные отклонения на «true»-чертежах ~5–9.5° / ~5–8 px (например, ∠ABC нарисован ~95° при заявленных 100°). Acceptance-критерий ТЗ (вердикт = суффикс) достижим только при ε=10; харнесс выставляет его ползунком, README (шаг 13) должен задокументировать.
- **PSM 10 крайне чувствителен к центрированию глифа** (сдвиг 7 px меняет K→N): поэтому чтение только через центроид чернил, а не центр вершины.
- **Апскейл перед OCR — только nearest**: high-quality smoothing делает глифы нечитаемыми (остаётся один B из шести).
- **Маскирование линий белым в целом вредно** для цельностраничного OCR (ломает layout analysis), но критично для точечного PSM 10 (отклеивает глифы, слитые с линиями).
- Вердикт «бюджет ≤3 s» в ui-shell QA заменён на «timings измерены»: требование убрано из ТЗ (brief §KPI), осознанное обновление теста, не ослабление.

### Problems solved

- `page.evaluate` не передаёт Node `Uint8Array` (JSON-сериализация) → фото дропалось битым: передавать plain Array, пересобирать `new Uint8Array(bytes)` в странице (паттерн ui-shell).
- Vite dev не переписывает bare-импорты в inline-`evaluate` → страничный код вынесен в `scripts/qa/diag-runner.js` (импортируется как модуль).
- PowerShell `Set-Content -Encoding UTF8` перекодирует кириллицу через ANSI (двойной mojibake на диске) — файлы с кириллицей править только editor-инструментом.
- Мутация массива во время `for...of` по нему (push объектов в итерируемый) → «.for is not iterable»: результаты копить в отдельный массив.

### Current state

- Гейты зелёные: test 157/157, typecheck, lint 0/0, format:check, build; `pnpm qa` 19/19; `pnpm qa:testdata` 4/4 (ε=10). Доки обновлены (build-plan 12 done, progress-tracker). Коммит фичи — следующий шаг сессии (single commit, memory включить).

### Next session starts with

- **13 Live QA + доки:** шаги corpus-прогона в `pnpm qa` или связка `qa:all`; README («Как это работает: текст → правила → проверка», честно про ε=10 корпуса и про то, что абсолютные длины не верифицируются); финальный коммит фазы 6.
- Живой CORS-чек Gemini (реальный ключ пользователя в браузере; проба `scripts/qa/gemini-cors-probe.mjs` готова).
- Опционально: исследовать стабилизацию ε (сейчас корпус живёт на максимуме ползунка 10; запас 0.5 px у биссектрисы задачи 1 — 9.48 ≤ 10).

### Open questions

- Живой CORS-чек Gemini REST (реальная сеть + ключ пользователя).
- Зависший fetch в Gemini-фолбэке (нет таймаута) — AbortController, если живой чек подтвердит.
- Запас по ε: биссектриса задачи 1 = 9.48 при допуске 10 — корпус на грани; если будущие правки сдвинут измерение, связка мигнёт.


## Session 12 — Phase 6/11: UI v2 — текст задачи + подтверждение правил (TDD + QA)

### What was built

- **Фича 11 реализована (гейты зелёные: 143/143 юнитов, typecheck, lint 0/0, format:check, build, QA 19/19).** План: `docs/superpowers/plans/2026-09-17-ui-v2.md`.
- Новые UI-модули: `task-text.ts` (textarea `#task-text`), `rules-preview.ts` (`{root, render(task, error)}`, кнопка `#confirm-rules` — human-in-the-loop шлюз), `gemini-fallback.ts` (`<details>`, поле API key → localStorage `geocheck.gemini-api-key`, автораскрытие при ошибке парсера), `verdict-checklist.ts` (чеклист по правилам + общий итог, `aria-live`), `relation-format.ts` (`formatRelation`/`formatTaskSummary`, 9 тестов).
- `run.ts`: извлечён `analyzeImage()` (`AnalyzeResult = Omit<PipelineResult,'verdict'>`, +2 теста); `analyzeDrawing` v1 оставлен (делегирует, старые тесты живы); UI его больше не вызывает.
- `demo-drawings.ts`: `DEMO_TASK_TEXT` = «∠ABC = 90°, AB ∥ CD, AB = CD, точка M лежит на отрезке AB» (+2 теста: парсится в 4 правила; идеал → Success, наклон → Fail).
- `app.ts` переписан: парсер на каждый input → предпросмотр → подтверждение → `evaluateRules`; сценарии/ε пересчитывают на сохранённом графе; `rule-select.ts` и `verdict-card.ts` удалены; `ui-shell.mjs` переписан на text→confirm-флоу (19/19, вкл. unhappy-пути: нечитаемый текст → фолбэк раскрыт, пустой чертёж → «не найдено отрезков»).

### Decisions made

- **Правка текста НЕ сбрасывает анализ** (граф зависит только от изображения): повторное подтверждение пересчитывает `evaluateRules` без повторного OCR — сохранён v1-инвариант «без повторного OCR» (план предполагал сброс; отклонение осознанное).
- **Пустая детекция в v2** → плейсхолдер `[Status: Error] На чертеже не найдено отрезков` (ТЗ §2) вместо Error-строк чеклиста: `runPipeline` возвращает рано при `segments.length === 0`.
- **Демо-режим тоже через шлюз подтверждения** (авто-верdictа при старте больше нет) — QA кликает `#confirm-rules`; предпросмотр при старте засеян `DEMO_TASK_TEXT`.
- ε-ползунок меняет вердикт без повторного подтверждения; сценарий демо переключается мгновенно при подтверждённых правилах.
- Prettier-нормализация зацепила несколько старых файлов (line endings) — включена в коммит фичи.

### Problems solved

- QA-шаг «ε=6 → Success» сломался в v2: чеклист содержит `M ∈ AB`, который на наклонной сцене фейлится независимо от ε → ассерт переведён на строку угла (первая `.check-row .badge`).
- Проба CORS Gemini (`scripts/qa/gemini-cors-probe.mjs`, невалидный ключ): из песочницы fetch ни resolve, ни reject за 60 с (egress заблокирован; без CORS-ошибки в консоли). Кнопка фолбэка при зависшем fetch остаётся busy — известное ограничение (AbortController вне скоупа). Живой чек с реальным ключом — за пользователем.

### Current state

- Гейты зелёные; `pnpm qa` 19/19 на `dist/`. Доки обновлены: build-plan (11 done), progress-tracker, ui-registry (task-text/rules-preview/gemini-fallback/relation-format/verdict-checklist shipped; rule-select/verdict-card removed), library-docs (CORS-секция переписана).

### Next session starts with

- **12 testdata-харнесс:** `scripts/qa/testdata.mjs` — puppeteer-прогон `testdata/1-text.txt`×`1-photo*-true|false.jpg`, `2-text.txt`×`2-photo-true.jpg` через `dist/`; сверка вердикта с суффиксом имени; калибровка ε=3.0.
- Параллельно: живой CORS-чек Gemini (реальный ключ пользователя в браузере; проба готова).

### Open questions

- Живой CORS-чек Gemini REST (реальная сеть + ключ пользователя; из песочницы не проверить).
- Зависший fetch в фолбэке (нет таймаута) — рассмотреть AbortController на шаге 13, если живой чек подтвердит проблему.


## Session 11 — Phase 6/10: Gemini fallback-клиент (TDD)

### What was built

- **Фича 10 реализована (TDD, гейты зелёные).** План: `docs/superpowers/plans/2026-09-17-gemini-fallback.md`.
- `src/pipeline/rules/gemini.ts` (+ spec, 10 тестов): `extractRulesGemini(text, apiKey, deps?)` → `ParseResult`. REST `gemini-2.0-flash:generateContent`, auth header `x-goog-api-key` (не query-param — ключ не светится в URL/логах), `generationConfig: {responseMimeType:'application/json', temperature:0}`. DI — минимальный структурный `FetchLike` (не `typeof fetch`, чтобы тесты не тянули DOM-типы); сеть в юнит-тестах не трогается.
- Строгая `validateRuleJson(raw)`: A–Z после trim+uppercase (2/3/1 буквы), per-kind проверки всех 7 kind'ов, points sort+dedup, givens опциональны → `ParsedTask {source:'gemini'}`.
- Мягкая ошибка `GEMINI_SOFT_ERROR = '[Status: Error] Не удалось разобрать текст задачи'` на: network reject, не-2xx, битый JSON, пустой candidates (safety), нарушенный контракт. Markdown-фенсы срезаются defensively.
- UI не трогали (поле API key и кнопка «Уточнить через ИИ» — фича 11); `app.ts` не менялся.

### Decisions made

- **Auth через header `x-goog-api-key`** вместо `?key=` — ключ не попадает в URL/логи. Endpoint/body сверены с официальными доками (ai.google.dev/api/generate-content) перед реализацией; текст ответа — `candidates[0].content.parts[*].text` (parts может быть несколько — склеивать).
- **Живой CORS-чек Gemini REST перенесён в фичу 11** — нужен реальный ключ пользователя в браузере; в этой сессии ключа не было. Endpoint документирован как CORS-enabled, но факт не проверен.

### Problems solved

- TS strict дважды укусил: `exactOptionalPropertyTypes` требует `init?: RequestInit | undefined` в тестовых типах; опечатка в cast-типе (`content` как массив вместо объекта) ломала optional chaining — cast-типы для внешних JSON проверять против схемы доки, не «на глаз».
- PowerShell: `2>&1` на native-командах (pnpm.cmd) даёт NativeCommandError и маскирует вывод — записано в skill-observations (#15); использовать `| Select-Object -Last N` без `2>&1`.

### Current state

- Гейты зелёные: 130/130 тестов (+10), typecheck ok, lint 0/0, build ok, `pnpm preview` smoke dist/ = HTTP 200. Доки обновлены: `library-docs.md` (Gemini — verified), `build-plan.md` (10 done, чеклист), `progress-tracker.md`.

### Next session starts with

- **11 UI v2 (mock-first):** textarea текста задачи вместо rule-select; область «Распознанные правила»; кнопка «Подтвердить и проверить» (human-in-the-loop); скрытая секция фолбэка (поле API key + «Уточнить через ИИ» → `extractRulesGemini`); verdict-чеклист по правилам. Мок-данные → визуальная проверка → проводка; в той же сессии — живой CORS-чек.

### Open questions

- Живой CORS-чек Gemini REST в браузере (фича 11; если заблокирован — задокументировать фактическое поведение).
- ε=3.0 px для равенства отрезков на «фото» — калибровать на шаге 12 (testdata-харнесс).


## Session 10 — Phase 6/09: Rule engine v2 (TDD)

### What was built

- **Фича 09 реализована (TDD, гейты зелёные).** План: `docs/superpowers/plans/2026-09-17-rules-engine-v2.md`.
- `src/pipeline/rules/rules-engine.ts` (+ spec, 19 тестов) — `evaluateRules(graph, relations, ε?)` → `{ results: {relation, result}[], verdict }`. Per-kind: `angle` (с именем угла), `parallel`/`equal`/`on-segment` (тексты v1 с подставленными именами); составные: `median` (on-segment конца чевианы + equal половин), `bisector` (|∠ABM − ∠MBC| ≤ ε), `height` (⊥ + точка на **прямой** стороны, новый хелпер `pointLineDistance`). Диспетчер резолвит метки через `resolveAll` → мягкая ошибка `[Status: Error] Точка X не найдена на чертеже`.
- `src/pipeline/geometry.ts` — геометрические хелперы, вынесенные из `verify.ts` (`dist`, `resolveAll`, `cornerAngleDeg`, `lineAngleDeg` + новый `pointLineDistance`); `verify.ts` делегирует, поведение v1 не изменено (10/10 зелёные).
- Агрегация: Success ⇔ все Success; любой Error → Error (доминирует над Fail); пустой `relations[]` (givens-only) → Success с пустым списком.

### Decisions made

- **Имя угла в сообщении угла — решение пользователя** (отход от формулировки ТЗ ред. 2026-09-17 «без имени угла»): `Ошибка: Угол ABC на рисунке равен 84.12°, отклонение составляет 5.88°`, Success `Верно: угол ABC = 100.00° (в пределах ε = 3.00)`. Зафиксировано в `build-plan.md`.
- Составное правило = один результат на relation: сообщение от провалившейся под-проверки; Success-сообщения: `BK — медиана треугольника ABC` (имя = side[0]+vertex+side[1]), `BM — биссектриса угла ABC (∠ABM = …, ∠MBC = …)`, `BM — высота к AC`.

### Problems solved

- **Editor `insert_line` по вычисленным номерам строк в один файл опасен:** последующие вставки сдвигают нумерацию → 3 раунда parse-error'ов (обрывы функций, дубли блоков) в rules-engine.ts/.spec.ts. Правило: для больших файлов — anchored replace-редактирование (уникальный old_text-якорь) или полная пересборка файла; после каждой вставки — перечитать стык. Записано в skill-observations (#14).

### Current state

- Гейты зелёные: 120/120 тестов (+19), typecheck ok, lint 0/0, build ok, `pnpm preview` smoke dist/ = HTTP 200. Рабочее дерево: только изменения фичи 09 (коммит следует за этим сохранением памяти).

### Next session starts with

- **10 Gemini fallback-клиент** (`src/pipeline/rules/gemini.ts`, TDD): `extractRulesGemini(text, apiKey, deps?)` — REST `generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent`, `responseMimeType: application/json`, strict prompt → Rule-JSON, валидация, DI-мок для тестов; невалидный ответ → мягкая ошибка; вызов ТОЛЬКО по явному действию пользователя. Живой CORS-чек REST в браузере (открытый вопрос).

### Open questions

- ε=3.0 px для равенства отрезков на «фото» может оказаться жёстким — калибровать на шаге 12 (testdata-харнесс).
- CORS Gemini REST в браузере — проверить живьём на шаге 10.


## Session 9 — Phase 6/08: Rule domain + оффлайн-парсер (TDD)

### What was built

- **Фича 08 реализована (TDD, гейты зелёные).** План: `docs/superpowers/plans/2026-09-17-task-rules-verification.md`.
- `src/pipeline/rules/types.ts` — `Segment`/`AngleName`/`Relation` (7 kind'ов)/`ParsedTask`/`ParseResult` (дискриминированное объединение `ok:true|ok:false` — мягкая ошибка вместо исключения, ТЗ §4).
- `src/pipeline/rules/normalize.ts` (+ spec, 8 тестов) — `normalizeTaskText`: блочная замена омоглифов (А,В,С,К,М,Н,Е,О,Р,Т,Х → латиница, включая В в предлоге «В треугольнике»), `<`→`∠`, схлопывание пробелов.
- `src/pipeline/rules/parse.ts` (+ spec, 17 тестов) — `parseTask`: треугольник («треугольник…») → чевианы в двух формах («медиана BK» / «BK-медиана», тире `-–—`) → угловые меры («∠ABC = 100°» и «угол ABC = 90», совпадения вырезаются пробелами перед equal/length-паттернами) → parallel (∥) / equal / on-segment («принадлежит отрезку», «лежит на отрезке») → длины → `givens` (обязательна единица мм|см|дм|км|м); dedup связей по JSON-ключу; `points` — sorted unique из relations.
- **Acceptance:** обе testdata-задачи парсятся оффлайн: 1-text → median(BK,AC)+bisector(BM,ABC)+angle(ABC,100)+«AC = 16 см»; 2-text → median(BM,AC)+bisector(BK,ABC)+angle(ABC,84)+«AC = 16 м»; points [A,B,C,K,M].

### Decisions made

- **Givens-only задача (правил нет, «дано» есть) → ok:true с пустым relations:** UI покажет пустой список правил → пользователь сам решит фолбэк Gemini (human-in-the-loop). ok:false только если нет ни правил, ни givens.
- Имя угла биссектрисы строится из треугольника: others = буквы треугольника без вершины чевианы (в порядке треугольника), angle = `o1+vertex+o2` (B→ABC, C→ACB).
- Единица длины обязательна в паттерне givens — присваивание «AB = 5» без единицы не попадает ни в equal, ни в givens (защита от ложных срабатываний).
- `noUncheckedIndexedAccess` действует и на строковые индексы (`s[0]` = `string | undefined`) — в чистом коде использовать `charAt()`.

### Problems solved

- TDD-фиксы ожиданий: (1) нормализация по ТЗ — блочная замена (Р→P, В→B даже в предлогах), а не «только в геометрических именах» — исправлены тесты, не код; (2) путь testdata из спеки — 3 уровня вверх (`../../../testdata`), не 4.
- PowerShell ретранслирует stderr pnpm как NativeCommandError и ломает пайпы (`2>&1 | Select` рвёт вывод); гейты гонять только `cmd /c "pnpm … && echo PASS || echo FAIL"` без 2>&1 (набл. 2, подтверждена).

### Current state

- Гейты зелёные: 101/101 тестов (+25), typecheck ok, lint 0/0, build ok. v1-код (dropdown/verify.ts) не тронут. Рабочее дерево чистое после коммита фичи.

### Next session starts with

- **09 Rule engine v2** (`src/pipeline/rules/rules-engine.ts`, TDD): оценка `Relation[]` по графу; угловая геометрия verify.ts выносится в хелперы; агрегация `{results, verdict}` (Success ⇔ все Success); RU-сообщения (контракт: `Ошибка: Угол на рисунке равен 84.12°, отклонение составляет 5.88°` — без имени угла); тесты per-kind pass/fail/soft + агрегация + границы (M за B → Fail).

### Open questions

- ε=3.0 px для равенства отрезков на «фото» может оказаться жёстким — калибровать на шаге 12 (testdata-харнесс).
- CORS Gemini REST в браузере — проверить живьём на шаге 10.


Last updated: 2026-09-17 (Session 8)


## Session 8 — ТЗ v2: текст задачи → правила → мульти-верификация (Phase 6 kickoff)

### What was built

- **Git pull** (19fd00f → 9ffcb2b): новый ТЗ (`product-brief.md` ред. 2026-09-17) + acceptance-корпус `testdata/` (2 задачи: `1-text` + 3 фото, `2-text` + 1 фото; имя = `<задача>-photo[-(N)]?-<true|false>.jpg`). Чужой `package-lock.json` удалён (репо на pnpm).
- **Workflow-доки синхронизированы с ТЗ v2** (коммит `docs(plan)`): `context/project-brief.md` (переписан), `architecture.md` (стадия text→rules, Rule-JSON-контракт, formulas v2, Env&Secrets), `build-plan.md` (Phase 6: 08–13), `progress-tracker.md`, `AGENTS.md` (pipeline 1–7), `.clinerules`, `PRODUCT.md`, `ui-registry.md` (task-text/rules-preview/gemini-fallback planned; rule-select deprecated), `library-docs.md` (Gemini REST, статус «not verified»).
- **`product-brief.md` дополнен §6 (аддендум проекта)** — решения команды зафиксированы в самом ТЗ против дрейфа: оффлайн-парсер основной + Gemini ручной фолбэк, human-in-the-loop шлюз, без `.env`-ключа, длины не верифицируются, testdata-корпус, омоглифы; AGENTS.md ссылается на §6 как канон.
- **План фичи:** `docs/superpowers/plans/2026-09-17-task-rules-verification.md`.

### Decisions made

- **Human-in-the-loop flow (пользователь, дословно):** оффлайн-парсер — основной путь; правила показываются в UI; если верны → пользователь подтверждает → верификация (Gemini не нужен); если парсер не справился → пользователь открывает секцию с полем Google API key → Gemini дорабатывает → правила снова показываются → подтверждение → верификация. Верификация НИКОГДА не запускается по неподтверждённым правилам.
- **Дефолтного ключа в `.env` НЕТ** (пользователь решил): в браузерном SPA `VITE_*` встраивается в бандл = публичный ключ. Key только через UI-поле (максимум localStorage), никогда в git.
- **Задачу не решаем:** абсолютные длины («АС = 16 см») не верифицируются (нет масштаба см→px) — парсер извлекает их в `givens` «дано» без проверки.
- **Rule-JSON контракт** (расширение примера ТЗ, tagged relations): `angle{angle,degrees}` / `parallel` / `equal` / `on-segment` / `median` / `bisector` / `height`; медиана = on-segment середины + equal половин; биссектриса = |∠ABM−∠MBC|; высота = ⊥+on-line; `angle` с N=90 обобщает перпендикуляр. Типы — `context/architecture.md`.
- **Контракт строк обновлён:** фейл `Ошибка: Угол на рисунке равен 84.12°, отклонение составляет 5.88°` (без имени угла!); софт-ошибка прежняя. Бюджет «≤3 c» из ТЗ убран (downscale + timings остаются как практика).
- Gemini-путь: REST `generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent`, `responseMimeType:'application/json'`, DI `fetchLike` (сеть не тестируем).
- **Acceptance парсера: обе testdata-задачи обязаны парситься оффлайн** (иначе автоматический харнесс не работает без ключа).

### Problems solved

- Пользователь сначала описал изменения «по памяти» — на диске их не было; найдены через `git fetch` + `git diff main origin/main` (коммиты 128224b/4701ef5/9ffcb2b), потом `git pull --ff-only`.
- **Кириллические омоглифы в testdata** («АВС», «ВМ», «∠АВС», `<АВС=84°`): парсеру нужна нормализация А→A, В→B, С→C, К→K, М→M, Н→H, Е→E, О→O, Р→P, Т→T, Х→X; `<`→`∠`.
- Просмотр testdata глазами: «true»-чертёж задачи 1 БЕЗ пометки 100° (угол проверяется геометрией, не подписью); false-варианты — фиолетовые заливки/дуги/засечки (риск конкурирующих отрезков); 2-photo-true — шумный скан (проверка OCR-устойчивости).

### Current state

- Гейты зелёные (76/76 тестов, lint 0/0, typecheck ok; build не гонялся — правки только в md). Коммиты: `12ba114` (chore deps), `e427038` (docs plan). Рабочее дерево чистое.
- Код v1 не тронут: dropdown/verify.ts v1 работают до проводки UI v2.

### Next session starts with

- **08 Rule domain + оффлайн-парсер** (TDD): `src/pipeline/rules/{types,normalize,parse}.ts` + спеки; acceptance: `parseTask(testdata/1-text)` → median(BK,AC)+bisector(BM,ABC)+angle(ABC,100)+givens; `2-text` → median+bisector+angle(84). План — `docs/superpowers/plans/2026-09-17-task-rules-verification.md`.

### Open questions

- ε=3.0 px для равенства отрезков на «фото» может оказаться жёстким — калибровать на testdata (пороги дедупа не трогать, ε — настройка UI).
- CORS Gemini REST в браузере — проверить живьём на фазе 10.


Last updated: 2026-09-13 (Session 7)


## Session 7 — Phase 5: 07 Performance & polish (даунскейл, замер стадий, a11y, README)

### What was built

- **Фаза 5 (07) завершена — все фазы билда закрыты.** План: `docs/superpowers/plans/2026-09-13-performance-polish.md` (написан в прерванной сессии вместе с большей частью кода; эта сессия довела QA, доки и коммит).
- **`src/pipeline/scale.ts`** (+ spec, 6 тестов): `scaledDimensions` (upscale запрещён, мин. 1 px) + `downscaleRawImage` (nearest-neighbour); `MAX_IMAGE_DIMENSION = 1600` в `constants.ts`.
- **`run.ts`**: `StageTimings` (detect/recognize/graph/verify/total) в `PipelineResult`; `formatTimings` в `ui/types.ts` (+1 тест) → строка `.verdict-timing mono` в verdict-card.
- **`image-input.ts`**: `fileToRawImage` → `DecodedImage { raw, previewUrl }` — декод с даунскейлом, превью из того же canvas (оверлей совпадает без пересчёта координат) + `imageSmoothingQuality: 'high'`.
- **UI/app:** async `onFile` (битое изображение → мягкая ошибка «Не удалось прочитать изображение»), «Проверить» без повторного декода (`state.raw`); canvas-view `role="img"` + aria-label; upload-zone hint «больше 1600 px сжимаются автоматически».
- **QA `ui-shell.mjs`:** шаги 10–12/15 (даунскейл 2000×1500 → 1600×1200; бюджет ≤ 3 s по строке timings; битое изображение; a11y-инварианты), диагностический try/catch с дампом verdict-card у шага 10. **README**: «Производительность», «OCR-дружелюбные чертежи», структура; build-plan/progress-tracker/ui-registry обновлены.

### Decisions made

- Пороги ТЗ применяются в «пикселях анализа» (после даунскейла); обратное масштабирование не вводим. Превью и анализ — всегда одного размера.
- `imageSmoothingQuality: 'high'` при даунскейле — точность анализа важнее стоимости декодирования.

### Problems solved

- **Двойной провал QA-шага 10 (даунскейл) — корневая причина найдена диагностическим дампом:** (1) метки в 45–75 px от вершин в масштабе анализа > LABEL_RADIUS 40; (2) главный фактор — глифы 128px (64px после ×0.5): штрихи ≥ 30 px создают competing-вершины, а билинейный даунскейл (smoothing low по умолчанию) размывал «C» — OCR молча терял метку → «Точка C не найдена». Рабочая фикстура: контент = геометрия шага 9 ×1.25 на 2000×1500 (даунскейл ×0.8, глифы 32px в анализе, центры ~28 px) + smoothing high. Правило: фикстуру пайплайна с даунскейлом проектировать в масштабе анализа (штрихи < 30 px И центры ≤ 40 px), не в масштабе холста.
- PowerShell: `$eval` внутри double-quoted строки интерполируется в пусто при генерации кода через Replace — код-в-строках собирать single-quoted литералами.


### Review fixes (/feature-review, same session)

- Программный ревью 3 слоёв по всем фазам: PASS; из 3 Minors исправлены 2: (1) README «Мягкие ошибки» — восстановлен потерянный закрывающий backtick (PowerShell-эскейп backtick в double-quoted Replace — та же ловушка, что и `$eval`, набл. 13); (2) `onFile` логирует ошибку декода в консоль (как `runPipeline`), а QA-шаг 16 белелистит ожидаемое «Не удалось прочитать изображение» из шага 12. Minor 3 (автотест catch-пути `runPipeline`) отложен — для app.ts нет DOM-харнесса, отдельное решение. Гейты + QA 16/16 перепроверены после фиксов.
### Current state

- 76/76 юнит-тестов, typecheck/lint/format/build зелёные, **live QA 16/16** (`pnpm qa`), консоль чистая. Коммит `feat(polish)` — в этой сессии.

### Next session starts with

- Опционально: финальная заливка на GitHub. Проект функционально завершён.

### Open questions

- Нет.

## Session 6 — Phase 4: 06 verify.ts + result UI (pipeline wiring)

### What was built

- **Фича 06 «Проводка пайплайна + result UI» реализована.** План: `docs/superpowers/plans/2026-09-13-pipeline-wiring.md`.
- **`src/pipeline/run.ts`** (+ spec, 10 тестов): `analyzeDrawing(image, rule, ε, deps?)` — композиция lines→dedup→ocr→graph→verify, возврат `PipelineResult { segments, labels, vertices, graph, unboundLabels, verdict }`; пустая детекция → мягкая ошибка `[Status: Error] На чертеже не найдено отрезков`; OCR/CV инъекция через `PipelineDeps`. Acceptance ТЗ §5: DI-тесты (84.12° → точный Fail-текст; M на AB через тик → Success; M за B через тик → Fail; метка далеко → `[Status: Error] Точка M не найдена на чертеже`) + e2e WASM (vitest: сегменты с растра линий + метки с растра букв → граф → софт-ошибка ТЗ).
- **UI:** `src/ui/image-input.ts` (`fileToRawImage`); `canvas-view.ts` — contain-fit изображения + `CanvasOverlay` (сегменты/вершины/метки через общий `drawOverlay`); `verdict-card.ts` — софт-ноты `updateVerdictCard(card, verdict, notes?)` + `setVerdictPlaceholder`; `app.ts` — «Проверить» запускает полный пайплайн (busy-состояние кнопки), смена правила/ε после анализа пересчитывает только `verify()` на сохранённом графе (OCR/CV не перезапускаются), без изображения — демо-режим.
- **Сопутствующие правки:** `OCR_PSM` 11→6; `src/pipeline/opencv-interop.ts`; QA-харнесс шаги 9–11.

### Decisions made

- **`OCR_PSM` 11→6**: psm 11 «sparse» молча теряет одиночные метки рядом с линиями (зависит от layout-анализа); psm 6 «однородный блок» читает их. Зафиксировано в `constants.ts` + `architecture.md`.
- **Интероп opencv-js**: UMD default — Promise; обёртка `__toESM` наследует `Promise.prototype` и выглядит thenable → ломает promise-разрешение в браузерном бандле (`TypeError … incompatible receiver`). Решение: `src/pipeline/opencv-interop.ts` разворачивает обёртки на уровне модуля (не через await-цепочки).
- **Продуктовая подсказка на будущее (Фаза 5):** OCR-дружелюбные чертежи — метки темнее линий; светло-серые линии (`#b0b0b0`) Otsu отбрасывает из OCR-вью, а Canny их детектирует (градиент ≈ 79 > CANNY_LOW).
- **UI-правило производительности:** полный пайплайн — только по кнопке «Проверить»; правило/ε — мгновенный verify() на сохранённом графе.

### Problems solved

- OCR на синтетических глифах — долгая отладка: блок-глифы A/B LSTM читает ненадёжно (A→E, B→L); чёрные линии портят распознавание соседних букв (A→T, пропуски); глифы со штрихами ≥ 30 px создают competing-вершины (метка цепляется за свой глиф). Рабочая схема QA-фикстуры: серые линии + чёрные Arial 32px (штрихи < 30 px), центры глифов в 28 px от вершин.
- Типовая ловушка Vitest-интеропа проявилась и в браузерном бандле (набл. 8); pnpm build с `>NUL` давал ложный PASS при упавшем tsc (набл. 11).
- Удалены временные отладочные артефакты (debug-pipeline.mjs, qa-bmp.spec, ocr-probe, qa-fixtures, логи/BMP).


### Review fixes (/feature-review, same session)

- Программный ревью 3 слоёв по всем фазам: PASS; из 3 Minors исправлены 2: (1) README «Мягкие ошибки» — восстановлен потерянный закрывающий backtick (PowerShell-эскейп backtick в double-quoted Replace — та же ловушка, что и `$eval`, набл. 13); (2) `onFile` логирует ошибку декода в консоль (как `runPipeline`), а QA-шаг 16 белелистит ожидаемое «Не удалось прочитать изображение» из шага 12. Minor 3 (автотест catch-пути `runPipeline`) отложен — для app.ts нет DOM-харнесса, отдельное решение. Гейты + QA 16/16 перепроверены после фиксов.
### Current state

- **Фаза 4 завершена (06 ✅):** 67/67 юнит-тестов, `typecheck`/`lint`/`format`/`build` зелёные, **live QA 12/12** (`pnpm qa`, headless Chrome): демо-режим (7 проверок) + реальный пайплайн ∠ABC=90° → Success + мгновенный пересчёт правила без OCR (soft-error «Точка D не найдена») + пустой чертёж → «не найдено отрезков» + чистая консоль.
- Пайплайн полностью подключён к UI: оверлей отрезков/вершин/меток, софт-ноты, busy-состояние.

### Next session starts with

- **Фаза 5 — 07 Performance & polish:** бюджет ≤ 3 s на CPU (замер, downscale-стратегия при больших изображениях), error/empty states, a11y-проход, README, финальный коммит. Сначала `/writing-plans`. Учесть: интероп-адаптер opencv и PSM 6 уже в коде; график OCR-дружелюбных чертежей (набл. 10) можно вынести в README-подсказку для пользователя.

### Open questions

- Нет открытых. (PSM-вопрос из ТЗ-этапа 04 закрыт выбором 6.)

## Session 5 — Phase 3: 05 Graph assembly

### What was built

- **Фича 05 «Graph assembly» реализована по TDD.** План: `docs/superpowers/plans/2026-09-13-graph-assembly.md`.
- **`src/pipeline/graph.ts`** (+ spec, 16 тестов, red→green): `buildGraph(segments, labels): GraphResult { graph: Record<string, Vertex>, vertices: Vertex[], unboundLabels: Label[] }` — чистая sync-функция (без DOM/WASM), паттерн dedup.ts. Кандидаты в вершины = **концы отрезков ∪ попарные пересечения**, лежащие в допуске `ON_SEGMENT_TOLERANCE`=2 px от обоих отрезков (пиксельный шум Hough); жадная кластеризация по `VERTEX_MERGE_RADIUS`=5 px (сортировка cy↑/cx↑, representative = первый участник, итог — центроид); привязка меток к ближайшей вершине ≤ `LABEL_RADIUS`=40 px, повторная буква — выигрывает привязка с минимальной дистанцией; вывод детерминирован (вершины cy↑/cx↑, labels вершин отсортированы).
- **Константы** в `constants.ts` (не из ТЗ): `INTERSECTION_DENOM_EPS=1e-9`, `ON_SEGMENT_TOLERANCE=2`, `VERTEX_MERGE_RADIUS=5`.
- Обновлены: `context/architecture.md` (стадия 4 + интерпретация), `context/build-plan.md` (05 ✅), `context/progress-tracker.md`.

### Decisions made

- **Концы отрезков считаются вершинами** (выбор пользователя): дословное «вершина = пересечение» из ТЗ ломает parallel/equal-segments — два отдельных параллельных отрезка не дают ни одного пересечения, метки A/B/C/D все drop → софт-ошибка на корректном чертеже. Зафиксировано в `context/architecture.md`.
- Лишние вершины без меток (например, концы засечки-тика поперёк AB) безвредны: граф для verify определяют метки, а не набор вершин.
- `graph` из `GraphResult` подаётся в `verify()` напрямую (те же объекты Vertex, что в `vertices`); `unboundLabels` — фид софт-нот для UI Фазы 4.

### Problems solved

- В тесте треугольника порядок вершин — cy↑: (100,100), (200,100), (100,200); первая правка ожиданий, не кода.
- Фикстура «дубликат буквы»: вторая метка должна быть *ближе* к своей вершине (dist 2.24 < 5), иначе «closest wins» выбирает первую.
- Пересечение прямых при коллинеарности/параллельности отсекается по `INTERSECTION_DENOM_EPS` — концы отрезков остаются кандидатами, поэтому коллинеарные A-M-B не теряют вершины в точках A и B.


### Review fixes (/feature-review, same session)

- Программный ревью 3 слоёв по всем фазам: PASS; из 3 Minors исправлены 2: (1) README «Мягкие ошибки» — восстановлен потерянный закрывающий backtick (PowerShell-эскейп backtick в double-quoted Replace — та же ловушка, что и `$eval`, набл. 13); (2) `onFile` логирует ошибку декода в консоль (как `runPipeline`), а QA-шаг 16 белелистит ожидаемое «Не удалось прочитать изображение» из шага 12. Minor 3 (автотест catch-пути `runPipeline`) отложен — для app.ts нет DOM-харнесса, отдельное решение. Гейты + QA 16/16 перепроверены после фиксов.
### Current state

- **Фаза 3 (OCR + Graph) завершена полностью:** 57/57 юнит-тестов (16 новых, ~5 ms), `typecheck`, `lint` 0/0, `format:check`, `build` — зелёные. Стадии по-прежнему не подключены к UI; graph в `dist/` tree-shaken.
- Пайплайн логически полный: lines → dedup → ocr → graph → verify (осталась только проводка).

### Next session starts with

- **Фаза 4 — 06 verify.ts + result UI:** проводка реального пайплайна (RawImage → `detectSegments` → `deduplicateSegments` → `recognizeLabels` → `buildGraph` → `verify`) в UI: оверлей отрезков/вершин/меток на холсте, софт-ноты из `unboundLabels`, acceptance-тесты ТЗ §5 (прямоугольный треугольник → Success; 84.12° при ε=3 → Fail с точным текстом; M за B → Fail). Сначала `/writing-plans`. UI живой → нужны проверки в `scripts/qa/ui-shell.mjs` + live-верификация в браузере.
- Держать в голове: OCR-стадия async и тяжёлая (~WASM) — кнопка «Проверить» становится обязательным триггером (автопересчёт убрать для тяжёлого пути); бюджет ≤ 3 s меряется в Фазе 5.

### Open questions

- Нет открытых.

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


### Review fixes (/feature-review, same session)

- Программный ревью 3 слоёв по всем фазам: PASS; из 3 Minors исправлены 2: (1) README «Мягкие ошибки» — восстановлен потерянный закрывающий backtick (PowerShell-эскейп backtick в double-quoted Replace — та же ловушка, что и `$eval`, набл. 13); (2) `onFile` логирует ошибку декода в консоль (как `runPipeline`), а QA-шаг 16 белелистит ожидаемое «Не удалось прочитать изображение» из шага 12. Minor 3 (автотест catch-пути `runPipeline`) отложен — для app.ts нет DOM-харнесса, отдельное решение. Гейты + QA 16/16 перепроверены после фиксов.
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


### Review fixes (/feature-review, same session)

- Программный ревью 3 слоёв по всем фазам: PASS; из 3 Minors исправлены 2: (1) README «Мягкие ошибки» — восстановлен потерянный закрывающий backtick (PowerShell-эскейп backtick в double-quoted Replace — та же ловушка, что и `$eval`, набл. 13); (2) `onFile` логирует ошибку декода в консоль (как `runPipeline`), а QA-шаг 16 белелистит ожидаемое «Не удалось прочитать изображение» из шага 12. Minor 3 (автотест catch-пути `runPipeline`) отложен — для app.ts нет DOM-харнесса, отдельное решение. Гейты + QA 16/16 перепроверены после фиксов.
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


### Review fixes (/feature-review, same session)

- Программный ревью 3 слоёв по всем фазам: PASS; из 3 Minors исправлены 2: (1) README «Мягкие ошибки» — восстановлен потерянный закрывающий backtick (PowerShell-эскейп backtick в double-quoted Replace — та же ловушка, что и `$eval`, набл. 13); (2) `onFile` логирует ошибку декода в консоль (как `runPipeline`), а QA-шаг 16 белелистит ожидаемое «Не удалось прочитать изображение» из шага 12. Minor 3 (автотест catch-пути `runPipeline`) отложен — для app.ts нет DOM-харнесса, отдельное решение. Гейты + QA 16/16 перепроверены после фиксов.
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


### Review fixes (/feature-review, same session)

- Программный ревью 3 слоёв по всем фазам: PASS; из 3 Minors исправлены 2: (1) README «Мягкие ошибки» — восстановлен потерянный закрывающий backtick (PowerShell-эскейп backtick в double-quoted Replace — та же ловушка, что и `$eval`, набл. 13); (2) `onFile` логирует ошибку декода в консоль (как `runPipeline`), а QA-шаг 16 белелистит ожидаемое «Не удалось прочитать изображение» из шага 12. Minor 3 (автотест catch-пути `runPipeline`) отложен — для app.ts нет DOM-харнесса, отдельное решение. Гейты + QA 16/16 перепроверены после фиксов.
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


### Review fixes (/feature-review, same session)

- Программный ревью 3 слоёв по всем фазам: PASS; из 3 Minors исправлены 2: (1) README «Мягкие ошибки» — восстановлен потерянный закрывающий backtick (PowerShell-эскейп backtick в double-quoted Replace — та же ловушка, что и `$eval`, набл. 13); (2) `onFile` логирует ошибку декода в консоль (как `runPipeline`), а QA-шаг 16 белелистит ожидаемое «Не удалось прочитать изображение» из шага 12. Minor 3 (автотест catch-пути `runPipeline`) отложен — для app.ts нет DOM-харнесса, отдельное решение. Гейты + QA 16/16 перепроверены после фиксов.
### Current state

- Фаза 0 (инициализация) завершена: `pnpm install` ок, `pnpm test`/`typecheck`/`lint`/`build` — зелёные (перепроверено при восстановлении сессии через `pnpm.cmd`).
- Сессия обрывалась ровно перед первым коммитом (git init + `git add` уже были сделаны); восстановлено: гейты перепроверены, первый коммит выполнен — см. `git log`.
- Фаза 1 (UI-шелл) ещё не начата — см. `context/build-plan.md`.

### Next session starts with

- **Phase 1 — 01 UI-shell:** drag-and-drop загрузка, список правил, слайдер ε, холст с mock-чертежом, панель вердикта (с mock-данными пайплайна → визуальная проверка → затем прожиг логики).

### Open questions

- Tesseract.js: локальный бандл `tessdata` vs CDN — решить на фазе 04 (OCR).