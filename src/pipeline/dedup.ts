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

/** Union-find с путевой компрессией: транзитивные кластеры отрезков. */
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
