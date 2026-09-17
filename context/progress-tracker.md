# Progress Tracker

Update this file after every completed feature. Any agent reading this should immediately know what is done, what is in progress, and what is next.

---

## Current Status

**Phase:** Phase 6 — Task-text rules + multi-rule verification **начата** (v2, ТЗ ред. 2026-09-17; бизнес-требования изменены: вход = изображение + текст задачи; правила из текста — оффлайн-парсер основной + Gemini фолбэк с подтверждением пользователем; верификация ВСЕХ правил; dropdown удалён; бюджет ≤3 c убран; `testdata/` = acceptance-корпус)
**Last completed:** 08 Rule domain + оффлайн-парсер (2026-09-17; `src/pipeline/rules/{types,normalize,parse}.ts` + спеки: Rule-JSON контракт, нормализация омоглифов + `<`→`∠`, парсинг треугольника/чевиан (обе формы)/угловых мер/parallel/equal/on-segment, длины → givens; обе testdata-задачи парсятся без ИИ; 101/101 тестов, гейты зелёные)
**Next up:** 09 Rule engine v2 (`rules-engine.ts` — оценка `Relation[]` по графу, переиспользование формул `verify.ts`, агрегация Success ⇔ все Success, RU-сообщения без имени угла)
