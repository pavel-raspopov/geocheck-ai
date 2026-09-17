# Feature 10 — Gemini fallback-клиент (`src/pipeline/rules/gemini.ts`)

Дата: 2026-09-17 · Фаза 6 · следующий шаг после фичи 09 (rule engine v2, `eb4a2df`).

## Цель

`extractRulesGemini(text, apiKey, deps?)` — ручной фолбэк извлечения правил из текста
задачи, когда оффлайн-парсер не справился. Вызывается ТОЛЬКО по явному действию
пользователя (human-in-the-loop; UI-проводка — фича 11). Возвращает существующий
`ParseResult` (мягкая ошибка вместо исключения, ТЗ §4).

## Контракт

```ts
export interface GeminiDeps {
  fetchLike?: typeof fetch; // DI для тестов; сеть в юнит-тестах не трогаем
}
export async function extractRulesGemini(
  text: string, apiKey: string, deps?: GeminiDeps,
): Promise<ParseResult>; // task.source === 'gemini'
```

- **Endpoint (доки ai.google.dev, сверено 2026-09-17):**
  `POST https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent`
  auth — header `x-goog-api-key` (не query-param: ключ не светится в URL/логах).
- **Body:** `{ contents: [{ parts: [{ text: PROMPT + text }] }], generationConfig: { responseMimeType: 'application/json', temperature: 0 } }`.
- **Response:** `candidates[0].content.parts[*].text` — склеить, отрезать markdown-фенсы
  (defensively), `JSON.parse`.
- **Валидация:** чистый `validateRuleJson(raw): ParsedTask | null` — kind'ы `Relation`
  (angle: `AngleName`+число; parallel/equal: 2 сегмента; on-segment: точка+сегмент;
  median/height: cevian+side; bisector: cevian+angle), буквы строго `A–Z` после
  trim+uppercase, `givens: string[]`. Невалидно → `null`.
- **Мягкая ошибка** (невалидный JSON / bad kind / HTTP != 2xx / network reject /
  пустые candidates / safety-block): `[Status: Error] Не удалось разобрать текст задачи`
  (failure model `architecture.md`).
- **Ключ:** только аргумент из UI (фича 11); не в `.env`, не в git (решение 2026-09-17).
- Промпт — константа модуля: строгая инструкция «Выдели… строго JSON» + схема
  Rule-JSON v2 (tagged kinds) из `architecture.md`; без SDK, голый `fetch`.

## TDD (red → green)

Spec `gemini.spec.ts` (фейковый `fetchLike`, записанные ответы):
1. happy path → `ok:true`, `source:'gemini'`, relations/givens; URL/method/headers/body
   проверены (model gemini-2.0-flash, `x-goog-api-key`, `responseMimeType`).
2. markdown-фенсы в тексте ответа → парсится.
3. невалидный JSON → мягкая ошибка.
4. неизвестный `kind` → мягкая ошибка.
5. сегмент длины 3 → мягкая ошибка.
6. `degrees` не число → мягкая ошибка.
7. строчные/пробелы в буквах → нормализуются (trim+uppercase).
8. HTTP 400 → мягкая ошибка.
9. network reject → мягкая ошибка.
10. пустой `candidates` / safety-block → мягкая ошибка.

## Верификация

`pnpm.cmd test` · `pnpm.cmd typecheck` · `pnpm.cmd lint` · `pnpm.cmd build` +
preview smoke. Живой CORS-чек REST в браузере — открытый вопрос (нужен ключ
пользователя в интерактиве; иначе переносится в фичу 11).

## Wrap-up

Обновить `context/progress-tracker.md`, `build-plan.md` (10 done),
`context/library-docs.md` (секция Gemini — verified-паттерны), `memory.md`;
один коммит `feat(rules): gemini fallback client (step 10)`.
