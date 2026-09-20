# Progress Tracker

Update this file after every completed feature. Any agent reading this should immediately know what is done, what is in progress, and what is next.

---

## Current Status

**Phase:** Phase 6 — Task-text rules + multi-rule verification **завершена** (v2, ТЗ ред. 2026-09-17; вход = изображение + текст задачи; правила из текста — оффлайн-парсер основной + Gemini фолбэк с подтверждением пользователем; верификация ВСЕХ правил; dropdown удалён; бюджет ≤3 c убран; `testdata/` = acceptance-корпус)
**Last completed:** 13 Live QA + доки (2026-09-18; `pnpm qa:all` = build → ui-shell 19/19 → testdata 4/4 (ε=10); README переписан под v2-флоу: «Как это работает: текст → правила → проверка», «Честные ограничения» (ε корпуса = 10, абсолютные длины не верифицируются, ~3–5 s); живой CORS-чек Gemini — за пользователем, AbortController отложен до подтверждения)
**Next up:** проект завершён в объёме ТЗ и Phase 6; живой CORS-чек Gemini закрыт (2026-09-18: fetch работает, AbortController не потребовался, модель → `gemini-3.6-flash`); из опционального — ε-стабилизация (запас 0.5 px у биссектрисы задачи 1), ретрай 503 в Gemini-фолбэке, расширение testdata-корпуса
**Docs (2026-09-20):** отчет по проекту — `docs/report.md` (аннотация, введение с гипотезой, теория/практика, заключение, список литературы).
