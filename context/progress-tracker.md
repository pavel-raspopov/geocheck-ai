# Progress Tracker

Update this file after every completed feature. Any agent reading this should immediately know what is done, what is in progress, and what is next.

---

## Current Status

**Phase:** Phase 6 — Task-text rules + multi-rule verification **начата** (v2, ТЗ ред. 2026-09-17; бизнес-требования изменены: вход = изображение + текст задачи; правила из текста — оффлайн-парсер основной + Gemini фолбэк с подтверждением пользователем; верификация ВСЕХ правил; dropdown удалён; бюджет ≤3 c убран; `testdata/` = acceptance-корпус)
**Last completed:** 07 Performance & polish (2026-09-13; даунскейл `scale.ts` + `MAX_IMAGE_DIMENSION` 1600; `StageTimings` в `run.ts` → строка `.verdict-timing` в verdict-card; `image-input.ts` — декод с превью одного размера + `imageSmoothingQuality: high`; битое изображение → мягкая ошибка; a11y canvas `role="img"`; README «OCR-дружелюбные чертежи». QA 16/16, 76/76 тестов, гейты зелёные)
**Next up:** 08 Rule domain + оффлайн-парсер (TDD; acceptance: обе testdata-задачи парсятся без ИИ)
