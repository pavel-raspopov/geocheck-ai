# Progress Tracker

Update this file after every completed feature. Any agent reading this should immediately know what is done, what is in progress, and what is next.

---

## Current Status

**Phase:** Phase 6 — Task-text rules + multi-rule verification **начата** (v2, ТЗ ред. 2026-09-17; бизнес-требования изменены: вход = изображение + текст задачи; правила из текста — оффлайн-парсер основной + Gemini фолбэк с подтверждением пользователем; верификация ВСЕХ правил; dropdown удалён; бюджет ≤3 c убран; `testdata/` = acceptance-корпус)
**Last completed:** 10 Gemini fallback-клиент (2026-09-17; `src/pipeline/rules/gemini.ts`: `extractRulesGemini(text, apiKey, deps?)` — REST gemini-2.0-flash, header `x-goog-api-key`, `responseMimeType: application/json`, строгая `validateRuleJson`, мягкая ошибка на любой сбой; DI `FetchLike`-мок, сеть в тестах не трогается; 10 тестов, 130/130, гейты зелёные. Живой CORS-чек — открытый вопрос до фичи 11)
**Next up:** 11 UI v2 (mock-first): textarea текста задачи, предпросмотр правил, кнопка «Подтвердить и проверить», скрытая секция фолбэка (поле API key + «Уточнить через ИИ» → `extractRulesGemini`), verdict-чеклист; + живой CORS-чек Gemini REST
