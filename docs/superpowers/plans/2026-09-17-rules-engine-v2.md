# Plan — 09 Rule engine v2 (multi-rule verification)

Date: 2026-09-17 · Phase 6 · Approved in plan mode (decision: имя угла возвращено в сообщения угла — отход от формулировки ТЗ ред. 2026-09-17 по решению пользователя).

## Goal

`src/pipeline/rules/rules-engine.ts` — чистая функция `evaluateRules(graph, relations, epsilon?)`: оценка списка `Relation[]` по графу вершин; возвращает `{ results, verdict }`; Success ⇔ все Success; Error доминирует над Fail; пустой `relations[]` (givens-only) → Success.

## Steps

1. **Рефакторинг-подготовка (поведение не меняется):** геометрические хелперы `verify.ts` (`dist`, `resolveAll`, `cornerAngleDeg`, `lineAngleDeg` + новый `pointLineDistance`) → `src/pipeline/geometry.ts`; `verify.ts` делегирует. Все тесты v1 остаются зелёными.
2. **TDD red:** `rules-engine.spec.ts` — per-kind pass/fail (angle с именем угла в сообщении, parallel, equal, on-segment), составные (median = on-segment + equal половин; bisector = |∠ABM − ∠MBC| ≤ ε; height = ⊥ + точка на прямой), границы (M за B → Fail), мягкие ошибки `[Status: Error] Точка X не найдена на чертеже`, агрегация (смешанные статусы, Error > Fail, пустой список).
3. **TDD green:** `rules-engine.ts` — параметризованные проверки вместо захардкоженных A/B/C/D; v1-функции `verify.ts` не трогаем.
4. **Гейты:** `cmd /c "pnpm test && pnpm typecheck && pnpm lint && pnpm build"` + preview smoke.
5. **Закрытие:** коммит `feat(rules): rule engine v2 (multi-rule verification)`, обновить progress-tracker / build-plan, `/remember save`.

## Messages (контракт, решение 2026-09-17 — имя угла возвращено)

- angle Success: `Верно: угол ABC = 100.00° (в пределах ε = 3.00)`
- angle Fail: `Ошибка: Угол ABC на рисунке равен 84.12°, отклонение составляет 5.88°`
- parallel / equal / on-segment — как в v1 `verify.ts`, с подставленными именами
- median: под-проверки возвращают свои сообщения; Success `Верно: BK — медиана треугольника ABC` (имя треугольника = side[0]+vertex+side[1])
- bisector Fail: `Ошибка: BM не является биссектрисой угла ABC: ∠ABM = 40.00°, ∠MBC = 10.00°, отклонение составляет 30.00°`; Success `Верно: BM — биссектриса угла ABC (∠ABM = 25.00°, ∠MBC = 25.00°)`
- height: под-проверки `… не перпендикулярна AC: угол X°` / `Точка M не лежит на прямой AC (расстояние X px)`; Success `Верно: BM — высота к AC`

## Decisions

- Агрегация: Error доминирует (непроверяемое состояние), иначе любой Fail → Fail, иначе Success.
- Составное правило → один результат на relation (сообщение от провалившейся под-проверки).
