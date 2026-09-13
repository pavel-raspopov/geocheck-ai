# 03 Deduplication Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Pure TS stage 2 of the pipeline (`src/pipeline/dedup.ts`) — cluster duplicate segments (angle ≤ 5°, distance ≤ 7 px) and merge each cluster into one segment spanning its two farthest endpoints.

**Architecture:** Synchronous pure function `deduplicateSegments(segments: LineSegment[]): LineSegment[]` in `src/pipeline/dedup.ts`. Union-find transitive clustering over pairwise checks; direction-independent angles; deterministic output (length-desc order, ids `seg-N`). No OpenCV, no DOM — Vitest unit tests with hand-built segments.

**Tech Stack:** Vanilla TypeScript (strict), Vitest 4. No new dependencies.

## Global Constraints

- Pure functions only: no DOM, no I/O, no randomness (context/code-standards.md).
- Thresholds ONLY from `src/pipeline/constants.ts`: `CLUSTER_ANGLE_DEG = 5`, `CLUSTER_DISTANCE = 7`. Never inline literals.
- TS strict incl. `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`; no `any`.
- Types from `src/pipeline/types.ts`: `LineSegment { id: string; x1: number; y1: number; x2: number; y2: number }`.
- Gates: `pnpm.cmd test`, `typecheck`, `lint`, `format:check`, `build` (PowerShell: gate via `cmd /c pnpm.cmd … && echo PASS`).
- One commit per feature, subject-only message.
- Files in scope: create `src/pipeline/dedup.ts`, `src/pipeline/dedup.spec.ts`, `docs/superpowers/plans/2026-09-13-deduplication.md`; modify `context/progress-tracker.md`, `context/build-plan.md`, `context/architecture.md`, `memory.md`. Frozen files (no edits): `src/pipeline/lines.ts`, `product-brief.md`.

## Design Decisions (approved)

1. **Direction-independent angle:** angle ∈ [0°, 180°); diff = `min(|a−b|, 180−|a−b|)`.
2. **Distance metric:** minimum segment-to-segment distance = min over the 4 endpoint→segment distances (0 for overlapping collinear fragments). Handles both parallel-offset Hough duplicates and collinear fragments.
3. **Transitive clustering (union-find):** A~B, B~C ⇒ one cluster even if A!~C. Deterministic (input order pairwise scan).
4. **Merge:** all 4 endpoints of every member; output = pair with max pairwise distance; direction normalized (leftmost-first, tie by y); output sorted length desc, ids `seg-N`.
5. **Guard:** zero-length segments → angle 0 (no NaN).

### Task 1: Failing spec for `deduplicateSegments`

**Files:**
- Create: `src/pipeline/dedup.spec.ts`

**Interfaces:**
- Consumes: `LineSegment` from `./types`, `CLUSTER_ANGLE_DEG`, `CLUSTER_DISTANCE` from `./constants`.
- Produces: tests importing `deduplicateSegments` from `./dedup` (Task 2 implements it).

- [ ] **Step 1: Write the failing tests**

```typescript
import { describe, expect, it } from 'vitest';
import { deduplicateSegments } from './dedup';
import { CLUSTER_DISTANCE } from './constants';
import type { LineSegment } from './types';

let nextId = 0;
function seg(x1: number, y1: number, x2: number, y2: number): LineSegment {
  return { id: `in-${nextId++}`, x1, y1, x2, y2 };
}

describe('deduplicateSegments (кластеризация 5°/7 px + слияние)', () => {
  it('два идентичных отрезка → один', () => {
    const result = deduplicateSegments([seg(100, 100, 200, 100), seg(100, 100, 200, 100)]);
    expect(result).toHaveLength(1);
  });

  it('параллельные дубли со сдвигом ≤ CLUSTER_DISTANCE px → сливаются', () => {
    const result = deduplicateSegments([seg(100, 100, 200, 100), seg(100, 103, 200, 103)]);
    expect(result).toHaveLength(1);
  });

  it('параллельные отрезки дальше CLUSTER_DISTANCE px → остаются двумя', () => {
    const gap = CLUSTER_DISTANCE + 3; // 10 px
    const result = deduplicateSegments([
      seg(100, 100, 200, 100),
      seg(100, 100 + gap, 200, 100 + gap),
    ]);
    expect(result).toHaveLength(2);
  });

  it('разность углов ≤ CLUSTER_ANGLE_DEG при близости → слияние', () => {
    const dy = 2 * Math.tan((3 * Math.PI) / 180);
    const result = deduplicateSegments([seg(100, 100, 200, 100), seg(100, 103, 200, 103 + dy)]);
    expect(result).toHaveLength(1);
  });

  it('разность углов > CLUSTER_ANGLE_DEG → не сливаются', () => {
    const dy = 2 * Math.tan((7 * Math.PI) / 180);
    const result = deduplicateSegments([seg(100, 100, 200, 100), seg(100, 103, 200, 103 + dy)]);
    expect(result).toHaveLength(2);
  });

  it('коллинеарные фрагменты одной прямой → один отрезок по крайним точкам', () => {
    const result = deduplicateSegments([seg(50, 100, 120, 100), seg(140, 100, 200, 100)]);
    expect(result).toHaveLength(1);
    const [merged] = result;
    expect(merged).toBeDefined();
    const xs = [merged!.x1, merged!.x2].sort((a, b) => a - b);
    expect(xs[0]).toBeCloseTo(50, 6);
    expect(xs[1]).toBeCloseTo(200, 6);
  });

  it('транзитивная цепочка A~B, B~C (A!~C) → один кластер', () => {
    const result = deduplicateSegments([
      seg(100, 100, 200, 100),
      seg(100, 103, 200, 103),
      seg(100, 106, 200, 106),
    ]);
    expect(result).toHaveLength(1);
  });

  it('направление не важно: отрезок A→B и тот же B→A → один кластер', () => {
    const result = deduplicateSegments([seg(100, 100, 200, 100), seg(200, 100, 100, 100)]);
    expect(result).toHaveLength(1);
  });

  it('перпендикулярные пересекающиеся отрезки → два', () => {
    const result = deduplicateSegments([seg(100, 100, 200, 100), seg(150, 50, 150, 150)]);
    expect(result).toHaveLength(2);
  });

  it('пустой вход → пустой выход; ids уникальны; порядок детерминирован (длина ↓)', () => {
    expect(deduplicateSegments([])).toEqual([]);
    const result = deduplicateSegments([seg(0, 0, 30, 0), seg(100, 100, 200, 100), seg(0, 200, 60, 200)]);
    const ids = new Set(result.map((s) => s.id));
    expect(ids.size).toBe(result.length);
    for (let i = 1; i < result.length; i++) {
      const prev = result[i - 1]!;
      const curr = result[i]!;
      const lenPrev = Math.hypot(prev.x2 - prev.x1, prev.y2 - prev.y1);
      const lenCurr = Math.hypot(curr.x2 - curr.x1, curr.y2 - curr.y1);
      expect(lenPrev).toBeGreaterThanOrEqual(lenCurr);
    }
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cmd /c pnpm.cmd test -- --run src/pipeline/dedup.spec.ts && echo PASS`
Expected: FAIL — `deduplicateSegments` не существует (cannot find module './dedup').

### Task 2: Implement `dedup.ts`

**Files:**
- Create: `src/pipeline/dedup.ts`

**Interfaces:**
- Consumes: `CLUSTER_ANGLE_DEG`, `CLUSTER_DISTANCE` from `./constants`; `LineSegment`, `Point` from `./types`.
- Produces: `deduplicateSegments(segments: LineSegment[]): LineSegment[]` — consumed by stage 05 (`graph.ts`) later.

- [ ] **Step 1: Implement the module** (full code below)

```typescript
/** Стадия 2 пайплайна (ТЗ §2): кластеризация дублей и слияние кластеров. */
import { CLUSTER_ANGLE_DEG, CLUSTER_DISTANCE } from './constants';
import type { LineSegment, Point } from './types';

/** Угол направления отрезка в градусах, нормализованный в [0, 180). */
function angleDeg(s: LineSegment): number {
  const deg = (Math.atan2(s.y2 - s.y1, s.x2 - s.x1) * 180) / Math.PI;
  return deg < 0 ? deg + 180 : deg;
}

/** Разность углов без учёта направления: min(|a−b|, 180−|a−b|). */
function angleDiffDeg(a: number, b: number): number {
  const diff = Math.abs(a - b);
  return Math.min(diff, 180 - diff);
}

/** Расстояние от точки до отрезка (не бесконечной прямой). */
function pointSegmentDistance(p: Point, s: LineSegment): number {
  const dx = s.x2 - s.x1;
  const dy = s.y2 - s.y1;
  const lenSq = dx * dx + dy * dy;
  if (lenSq === 0) return Math.hypot(p.x - s.x1, p.y - s.y1);
  const t = Math.max(0, Math.min(1, ((p.x - s.x1) * dx + (p.y - s.y1) * dy) / lenSq));
  return Math.hypot(p.x - (s.x1 + t * dx), p.y - (s.y1 + t * dy));
}

/** Метрика близости: минимум по 4 парам конец→отрезок (0 при наложении). */
function segmentsDistance(a: LineSegment, b: LineSegment): number {
  const pa: Point[] = [
    { x: a.x1, y: a.y1 },
    { x: a.x2, y: a.y2 },
  ];
  const pb: Point[] = [
    { x: b.x1, y: b.y1 },
    { x: b.x2, y: b.y2 },
  ];
  let min = Infinity;
  for (const p of pa) min = Math.min(min, pointSegmentDistance(p, b));
  for (const p of pb) min = Math.min(min, pointSegmentDistance(p, a));
  return min;
}

/** Два отрезка близки по ТЗ §3.2: Δугла ≤ 5° И расстояние ≤ 7 px. */
function isNear(a: LineSegment, b: LineSegment): boolean {
  return (
    angleDiffDeg(angleDeg(a), angleDeg(b)) <= CLUSTER_ANGLE_DEG &&
    segmentsDistance(a, b) <= CLUSTER_DISTANCE
  );
}

class UnionFind {
  private readonly parent: number[];

  constructor(size: number) {
    this.parent = Array.from({ length: size }, (_, i) => i);
  }

  find(i: number): number {
    let root = i;
    while (this.parent[root] !== root) root = this.parent[root]!;
    while (this.parent[i] !== root) {
      const next = this.parent[i]!;
      this.parent[i] = root;
      i = next;
    }
    return root;
  }

  union(i: number, j: number): void {
    this.parent[this.find(i)] = this.find(j);
  }
}

/** Слияние кластера: один отрезок по двум самым удалённым концам (ТЗ §3.2). */
function mergeCluster(members: LineSegment[]): LineSegment {
  const points: Point[] = members.flatMap((s) => [
    { x: s.x1, y: s.y1 },
    { x: s.x2, y: s.y2 },
  ]);
  let bestA = points[0]!;
  let bestB = points[0]!;
  let bestDist = -1;
  for (let i = 0; i < points.length; i++) {
    for (let j = i + 1; j < points.length; j++) {
      const d = Math.hypot(points[j]!.x - points[i]!.x, points[j]!.y - points[i]!.y);
      if (d > bestDist) {
        bestDist = d;
        bestA = points[i]!;
        bestB = points[j]!;
      }
    }
  }
  // Детерминированное направление: левее-выше точка первой.
  const swap = bestA.x > bestB.x || (bestA.x === bestB.x && bestA.y > bestB.y);
  const p1 = swap ? bestB : bestA;
  const p2 = swap ? bestA : bestB;
  return { id: '', x1: p1.x, y1: p1.y, x2: p2.x, y2: p2.y };
}

/**
 * Дедупликация: кластеризация (Δугла ≤ 5° И расстояние ≤ 7 px, транзитивно,
 * union-find) → слияние кластера по двум дальним концам. Детерминированный
 * вывод: длина ↓, ids `seg-N`. Чистая функция без DOM/I/O.
 */
export function deduplicateSegments(segments: LineSegment[]): LineSegment[] {
  const uf = new UnionFind(segments.length);
  for (let i = 0; i < segments.length; i++) {
    for (let j = i + 1; j < segments.length; j++) {
      if (isNear(segments[i]!, segments[j]!)) uf.union(i, j);
    }
  }
  const clusters = new Map<number, LineSegment[]>();
  segments.forEach((s, i) => {
    const root = uf.find(i);
    const bucket = clusters.get(root);
    if (bucket) bucket.push(s);
    else clusters.set(root, [s]);
  });
  const merged = [...clusters.values()].map(mergeCluster);
  const lengthOf = (s: LineSegment): number => Math.hypot(s.x2 - s.x1, s.y2 - s.y1);
  merged.sort((a, b) => lengthOf(b) - lengthOf(a) || a.y1 - b.y1 || a.x1 - b.x1);
  return merged.map((s, index) => ({ ...s, id: `seg-${index}` }));
}
```

- [ ] **Step 2: Run tests to verify they pass**

Run: `cmd /c pnpm.cmd test -- --run src/pipeline/dedup.spec.ts && echo PASS`
Expected: PASS (10/10).

### Task 3: Full gates + docs update

**Files:**
- Modify: `context/progress-tracker.md` (03 → ✅), `context/build-plan.md` (03 ✅ + metric note), `context/architecture.md` (document the distance metric + transitive clustering).

- [ ] **Step 1:** `cmd /c pnpm.cmd test && echo PASS` → all suites green (22 existing + 10 new).
- [ ] **Step 2:** `cmd /c pnpm.cmd typecheck && echo PASS`; `cmd /c pnpm.cmd lint && echo PASS`; `cmd /c pnpm.cmd format:check && echo PASS`; `cmd /c pnpm.cmd build && echo PASS`.
- [ ] **Step 3:** Update the three context docs (mark 03 done; in architecture.md stage 2 line add: «метрика — минимум из 4 расстояний конец→отрезок; кластеризация транзитивна (union-find)»).

### Task 4: Memory + single commit

- [ ] **Step 1:** `/remember save` → rewrite `memory.md` (Session 3 section; keep prior sessions).
- [ ] **Step 2:** Sequential git (never parallel — index.lock): `git add` → `git commit -m "feat(pipeline): deduplication stage (5°/7px clustering + farthest-endpoint merge)"` → `git log --oneline -3`.
