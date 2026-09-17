# Progress Tracker

Update this file after every completed feature. Any agent reading this should immediately know what is done, what is in progress, and what is next.

---

## Current Status

**Phase:** Phase 6 — Task-text rules + multi-rule verification **начата** (v2, ТЗ ред. 2026-09-17; бизнес-требования изменены: вход = изображение + текст задачи; правила из текста — оффлайн-парсер основной + Gemini фолбэк с подтверждением пользователем; верификация ВСЕХ правил; dropdown удалён; бюджет ≤3 c убран; `testdata/` = acceptance-корпус)
**Last completed:** 11 UI v2 (2026-09-17; text→confirm флоу: `task-text`/`rules-preview`/`gemini-fallback`/`verdict-checklist`/`relation-format`, `run.ts` → `analyzeImage()`, `DEMO_TASK_TEXT`, `rule-select` удалён; парсер на input → human-in-the-loop подтверждение → `evaluateRules`; QA 19/19, юниты 143/143, гейты зелёные. Живой CORS-чек Gemini — открытый вопрос: проба из песочницы ответа не получила)
**Next up:** 12 testdata-харнесс (`scripts/qa/testdata.mjs`): puppeteer-прогон `testdata/N-text.txt` × `N-photo*-true|false.jpg` через `dist/`, сверка вердикта с суффиксом; калибровка ε=3.0; + живой CORS-чек Gemini с реальным ключом пользователя
