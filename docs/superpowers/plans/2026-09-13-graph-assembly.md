# 05 Graph Assembly Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** `src/pipeline/graph.ts` — `buildGraph(segments, labels): GraphResult` — вершины из дедуплицированных отрезков + привязка меток к ближайшей вершине ≤ 40 px (ТЗ §2.5); неподошедшие метки → `unboundLabels` (софт-ноты для UI Фазы 4).

**Architecture:** Стадия 4 пайплайна; чистая sync-функция, без DOM/WASM (паттерн `dedup.ts`). Вход — вывод `deduplicateSegments` + `recognizeLabels`. Выходной `graph: Record<string, Vertex>` подаётся напрямую в `verify()`.

**Tech Stack:** Vitest 5, TypeScript strict (без новых зависимостей).

## Global Constraints

- ТЗ §2.5 дословно: «Сборка графа: вершина = точка пересечения отфильтрованных отрезков; буква привязывается к ближайшей вершине ≤ 40 px».
- **Утверждённая пользователем интерпретация:** кандидатами в вершины являются **и пересечения, и концы отрезков** (иначе два отдельно нарисованных параллельных отрезка не дают ни одного пересечения — правила parallel/equal-segments никогда бы не прошли). Зафиксировать в `context/architecture.md`.
- Пороги только из `constants.ts`: `LABEL_RADIUS = 40` (ТЗ); новые внутренние (не из ТЗ): `VERTEX_MERGE_RADIUS`, `ON_SEGMENT_TOLERANCE`, `INTERSECTION_DENOM_EPS`.
- Вершины из «засечек» (концы тика поперёк отрезка) безвредны: лишние вершины без меток не влияют на `verify()` — метки определяют граф.
- Пунктуация контракта: дубликат буквы — выигрывает привязка с минимальным расстоянием; вывод детерминирован (вершины cy↑/cx↑, labels отсортированы).
- PowerShell: гейты как `cmd /c "pnpm.cmd test && echo PASS || echo FAIL"` (observation #2); git-команды не батчить (observation #4).
- Один коммит в конце: `feat(pipeline): graph assembly (vertices + label binding)`, subject only; план + доки + memory — тем же коммитом.
- UI-поверхности у фичи нет (подключение — Фаза 4/06); live-QA не требуется.

## File Structure

- Create: `src/pipeline/graph.ts` — `buildGraph`, внутренние: `lineIntersection`, `collectCandidates`, `clusterPoints`, `pointSegmentDistance`; экспорт типа `GraphResult`.
- Create: `src/pipeline/graph.spec.ts` — чистые юнит-тесты на синтетике + интеграция с `verify()`.
- Modify: `src/pipeline/constants.ts` — блок внутренних констант стадии graph.
- Modify (после зелёных): `context/architecture.md`, `context/build-plan.md`, `context/progress-tracker.md`, `memory.md`.

---

### Task 1: Constants + спецификация (RED)

- [ ] Добавить в `constants.ts` внутренние параметры стадии graph.
- [ ] Написать `graph.spec.ts` (~14 тестов, список ниже). Запуск: `cmd /c "pnpm.cmd test -- graph && echo PASS || echo FAIL"` → FAIL (модуля нет).

### Task 2: Реализация (GREEN)

- [ ] `graph.ts`: кандидаты (концы + пересечения в допуске `ON_SEGMENT_TOLERANCE` от обоих отрезков) → кластеризация жадным слиянием по `VERTEX_MERGE_RADIUS` (сортировка cy↑/cx↑, центроид кластера) → привязка меток к ближайшей вершине ≤ `LABEL_RADIUS`, дубликаты букв по min-дистанции.
- [ ] Прогнать `pnpm test -- graph` → зелёные.

### Task 3: Гейты, доки, memory, коммит

- [ ] `format` → `test` → `typecheck` → `lint` → `format:check` → `build` (последовательно, PASS/FAIL по exit-коду).
- [ ] Доки: architecture (стадия 4 + интерпретация endpoints), build-plan (05 ✅), progress-tracker.
- [ ] `/remember save` → `memory.md` (Session 5).
- [ ] Один коммит: `git add -A ; git commit -m "feat(pipeline): graph assembly (vertices + label binding)"`.

## Test list (spec coverage)

1. Треугольник из 3 отрезков → 3 вершины в углах (порядок cy↑/cx↑).
2. Один отрезок → 2 вершины-конца (endpoints = вершины).
3. T-примыкание → одна вершина в точке касания (без дублей).
4. Недолёт конца 2 px (≤ ON_SEGMENT_TOLERANCE) → пересечение засчитано; 4 px → нет.
5. Два одинаковых отрезка → совпадающие концы сливаются (2 вершины, не 4).
6. Метка на LABEL_RADIUS − 1 → привязана; LABEL_RADIUS + 1 → unboundLabels.
7. Привязка к ближайшей из нескольких вершин.
8. Дубликат буквы → выигрывает ближайшая вершина.
9. Нет вершин → все метки unbound; пустой вход → пустой выход.
10. Детерминизм: два прогона глубоко равны.
11. Интеграция: прямоугольный треугольник ABC → verify perpendicular Success.
12. Интеграция: параллельные AB и CD → verify parallel Success.
13. Интеграция: M на AB через засечку → verify point-on-segment Success.

## Self-Review

- Spec coverage: ТЗ §2.5 (вершины/привязка 40 px) → Tasks 1–2; интерпретация endpoints — утверждена пользователем, документируется; verify-интеграция — тесты 11–13.
- Placeholders: нет. Types: `GraphResult` определён в graph.ts, потребляет `Vertex`/`Label`/`LineSegment` из types.ts.
