# Progress Tracker

Update this file after every completed feature. Any agent reading this should immediately know what is done, what is in progress, and what is next.

---

## Current Status

**Phase:** Phase 6 — Task-text rules + multi-rule verification **начата** (v2, ТЗ ред. 2026-09-17; бизнес-требования изменены: вход = изображение + текст задачи; правила из текста — оффлайн-парсер основной + Gemini фолбэк с подтверждением пользователем; верификация ВСЕХ правил; dropdown удалён; бюджет ≤3 c убран; `testdata/` = acceptance-корпус)
**Last completed:** 09 Rule engine v2 (2026-09-17; `src/pipeline/rules/rules-engine.ts` + `src/pipeline/geometry.ts`: `evaluateRules(graph, relations, ε)` → `{results, verdict}`; per-kind проверки angle/parallel/equal/on-segment + составные median/bisector/height; агрегация Success ⇔ все Success, Error > Fail; имя угла возвращено в сообщения — решение пользователя; 120/120 тестов, гейты зелёные)
**Next up:** 10 Gemini fallback-клиент (`extractRulesGemini(text, apiKey, deps?)` — REST, strict prompt → Rule-JSON, DI-мок; только по явному действию пользователя; API key из UI-поля)
