# Progress Tracker

Update this file after every completed feature. Any agent reading this should immediately know what is done, what is in progress, and what is next.

---

## Current Status

**Phase:** Phase 6 — Task-text rules + multi-rule verification **начата** (v2, ТЗ ред. 2026-09-17; бизнес-требования изменены: вход = изображение + текст задачи; правила из текста — оффлайн-парсер основной + Gemini фолбэк с подтверждением пользователем; верификация ВСЕХ правил; dropdown удалён; бюджет ≤3 c убран; `testdata/` = acceptance-корпус)
**Last completed:** 12 testdata-харнесс (2026-09-17; `scripts/qa/testdata.mjs` + `pnpm qa:testdata`: 4/4 связок acceptance-корпуса зелёные при ε=10; калибровка пайплайна: OCR-подготовка pad32+×2 nearest (`ocr-prep.ts`), refine-проход PSM 10 вокруг непомеченных вершин (`ocr-refine.ts`, центроид глифа + двойная маска), точные углы графа через пересечения поддерживающих прямых + union-find кластеризация (радиус 12); юниты 157/157, гейты зелёные)
**Next up:** 13 Live QA + доки: шаги нового флоу в `pnpm qa`, README («Как это работает: текст → правила → проверка»), финальный коммит фазы; живой CORS-чек Gemini с реальным ключом пользователя
