# Plan — Фича 12: testdata-харнесс (acceptance-корпус через dist/)

Дата: 2026-09-17. Build-plan Phase 6, шаг 12.

## Цель

`scripts/qa/testdata.mjs` — puppeteer-прогон связок acceptance-корпуса `testdata/`
через собранный `dist/`; вердикт каждой связки совпадает с суффиксом
`-true/-false` при ε = 3.0 (дефолт). Цель: 4/4 зелёные.

- `1-text.txt` × `1-photo-true.jpg`, `1-photo(1)-false.jpg`, `1-photo(2)-false.jpg`
- `2-text.txt` × `2-photo-true.jpg`

Acceptance-критерий ТЗ §5: обе задачи парсятся оффлайн-парсером (фолбэк закрыт).

## Шаги

1. Скрипт `scripts/qa/testdata.mjs` по паттерну `ui-shell.mjs` (vite preview + system Chrome):
   свежая страница на связку → текст из `N-text.txt` (UTF-8) в `#task-text` →
   парсер отдал `.rules-item`, `.fallback-details` закрыт → дроп фото через
   DataTransfer → «Изображение загружено» → `#confirm-rules` → чеклист →
   сверка overall-бейджа (`#verdict-region .badge`) с суффиксом (true → «Верно», false → «Ошибка»).
2. Скрипт `qa:testdata` в package.json (build + прогон), отдельно от `pnpm qa`.
3. Прогон; при фейлах — диагностика (строки чеклиста, console-шум), калибровка порогов
   только через `src/pipeline/constants.ts` + TDD.
4. Гейты: test / typecheck / lint / format:check / build + живой прогон харнесса.
5. Доки: build-plan [x] 12, progress-tracker, `/remember save`; один коммит
   `feat(qa): testdata acceptance harness (step 12)`.

## Риски

- OCR/детекция на реальных фото нестабильна → фейл связки = находка калибровки, не маскируем.
- `-false` связки: ожидаем строго Fail (overall «Ошибка»); мягкая ошибка — сигнал проблемы.
- Кодировка `N-text.txt` (PowerShell-вывод был в ANSI): харнесс проверяет парсинг
  (rules ≥ 1, фолбэк закрыт) — это ловит битую кодировку.
