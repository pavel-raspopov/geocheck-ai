/** Стадия 4 пайплайна (ТЗ §2): сборка графа — вершины из отрезков + привязка меток. */
import {
  ENDPOINT_MATCH_TOLERANCE,
  INTERSECTION_CORNER_TOLERANCE,
  INTERSECTION_DENOM_EPS,
  LABEL_RADIUS,
  VERTEX_MERGE_RADIUS,
} from './constants';
import type { Label, LineSegment, Point, Vertex } from './types';

/** Результат сборки графа: вход для verify() + данные для UI-оверлея (Фаза 4). */
export interface GraphResult {
  /** Метка (заглавная A–Z) → вершина; подаётся напрямую в verify(). */
  graph: Record<string, Vertex>;
  /** Все вершины в детерминированном порядке (cy ↑, cx ↑), включая без меток. */
  vertices: Vertex[];
  /** Метки без вершины в радиусе LABEL_RADIUS — софт-ноты в UI (ТЗ §2.5 «иначе drop»). */
  unboundLabels: Label[];
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

/** Точка пересечения поддерживающих прямых; undefined — если прямые параллельны. */
function lineIntersection(a: LineSegment, b: LineSegment): Point | undefined {
  const dax = a.x2 - a.x1;
  const day = a.y2 - a.y1;
  const dbx = b.x2 - b.x1;
  const dby = b.y2 - b.y1;
  const denom = dax * dby - day * dbx;
  if (Math.abs(denom) < INTERSECTION_DENOM_EPS) return undefined;
  const t = ((b.x1 - a.x1) * dby - (b.y1 - a.y1) * dbx) / denom;
  return { x: a.x1 + t * dax, y: a.y1 + t * day };
}

/**
 * Кандидаты в вершины: концы отрезков + пересечения пар, лежащие (с допуском
 * ON_SEGMENT_TOLERANCE на пиксельный шум Hough) на обоих отрезках. Концы
 * считаются вершинами по утверждённой интерпретации ТЗ §2.5: иначе два
 * отдельно нарисованных параллельных отрезка не дают ни одной вершины, и
 * правила parallel/equal-segments не могут привязать метки A/B/C/D.
 */
function collectCandidates(segments: LineSegment[]): Point[] {
  // Кандидаты: концы (с владельцем) + пересечения поддерживающих прямых.
  const candidates: Point[] = [];
  const owner: number[] = []; // индекс сегмента-владельца конца, -1 — пересечение
  segments.forEach((s, i) => {
    candidates.push({ x: s.x1, y: s.y1 }, { x: s.x2, y: s.y2 });
    owner.push(i, i);
  });

  const accepted: { p: Point; a: number; b: number }[] = [];
  for (let i = 0; i < segments.length; i++) {
    for (let j = i + 1; j < segments.length; j++) {
      const a = segments[i]!;
      const b = segments[j]!;
      const p = lineIntersection(a, b);
      if (!p) continue;
      // Пересечение поддерживающих прямых — точный угол чертежа: Hough-концы
      // недолетают/перелетают угол, поэтому допуск INTERSECTION_CORNER_TOLERANCE
      // перекрывает шум концов (калибровка фичи 12 на testdata).
      if (
        pointSegmentDistance(p, a) <= INTERSECTION_CORNER_TOLERANCE &&
        pointSegmentDistance(p, b) <= INTERSECTION_CORNER_TOLERANCE
      ) {
        accepted.push({ p, a: i, b: j });
        candidates.push(p);
        owner.push(-1);
      }
    }
  }

  // Перелётные концы: если ОБА отрезка заканчиваются у общего угла p (конец
  // каждого — в ENDPOINT_MATCH_TOLERANCE от p), концы — шум рендера/Hough,
  // вершина = пересечение поддерживающих прямых. Одиночный конец рядом с
  // пересечением (засечка поперёк отрезка) сохраняется.
  const dropped = new Set<number>();
  for (const { p, a, b } of accepted) {
    for (const [self, other] of [
      [a, b],
      [b, a],
    ] as const) {
      for (let k = 0; k < candidates.length; k++) {
        if (owner[k] !== self || dropped.has(k)) continue;
        const e = candidates[k]!;
        if (Math.hypot(e.x - p.x, e.y - p.y) > INTERSECTION_CORNER_TOLERANCE) continue;
        const otherEndsNear = [0, 1].some((end) => {
          const q = endPoint(segments[other]!, end);
          return Math.hypot(q.x - p.x, q.y - p.y) <= ENDPOINT_MATCH_TOLERANCE;
        });
        if (otherEndsNear) dropped.add(k);
      }
    }
  }

  return candidates.filter((_, k) => !dropped.has(k));
}

/** Конец отрезка по индексу (0 — начало, 1 — конец). */
function endPoint(s: LineSegment, end: number): Point {
  return end === 0 ? { x: s.x1, y: s.y1 } : { x: s.x2, y: s.y2 };
}

/** Кластер кандидатов: координаты копятся для центроида. */
interface Cluster {
  sumX: number;
  sumY: number;
  n: number;
}

/**
 * Кластеризация кандидатов: транзитивное объединение (union-find, паттерн
 * dedup.ts) по радиусу VERTEX_MERGE_RADIUS. Транзитивность важна: угловой
 * кластер «недолётший конец + конец + пересечение поддерживающих прямых»
 * сцепляется цепочкой кандидатов на расстоянии ≤ радиуса. Детерминировано
 * сортировкой входа.
 */
function clusterPoints(points: Point[]): Point[] {
  const sorted = [...points].sort((a, b) => a.y - b.y || a.x - b.x);
  const parent = sorted.map((_, i) => i);
  const find = (i: number): number => (parent[i] === i ? i : (parent[i] = find(parent[i]!)));
  for (let i = 0; i < sorted.length; i++) {
    for (let j = i + 1; j < sorted.length; j++) {
      if (
        Math.hypot(sorted[j]!.x - sorted[i]!.x, sorted[j]!.y - sorted[i]!.y) <= VERTEX_MERGE_RADIUS
      ) {
        parent[find(j)!] = find(i)!;
      }
    }
  }
  const clusters = new Map<number, Cluster>();
  for (let i = 0; i < sorted.length; i++) {
    const root = find(i)!;
    const cluster = clusters.get(root) ?? { sumX: 0, sumY: 0, n: 0 };
    cluster.sumX += sorted[i]!.x;
    cluster.sumY += sorted[i]!.y;
    cluster.n += 1;
    clusters.set(root, cluster);
  }
  return [...clusters.values()]
    .map((c) => ({ x: c.sumX / c.n, y: c.sumY / c.n }))
    .sort((a, b) => a.y - b.y || a.x - b.x);
}

/**
 * Сборка графа (ТЗ §2.5): вершины из дедуплицированных отрезков, каждая метка
 * привязывается к ближайшей вершине в радиусе LABEL_RADIUS (иначе — в
 * unboundLabels). Повторная буква OCR: выигрывает привязка с минимальным
 * расстоянием. Чистая функция без DOM/I/O; вывод детерминирован
 * (вершины cy ↑ / cx ↑, labels вершин отсортированы). Буква считается уже
 * приведённой к UPPERCASE стадией OCR.
 */
export function buildGraph(segments: LineSegment[], labels: Label[]): GraphResult {
  const centers = clusterPoints(collectCandidates(segments));
  centers.sort((a, b) => a.y - b.y || a.x - b.x);
  const vertices: Vertex[] = centers.map((c) => ({ x: c.x, y: c.y, labels: [] }));

  const graph: Record<string, Vertex> = {};
  const unboundLabels: Label[] = [];
  const best = new Map<string, { index: number; dist: number }>();
  for (const label of labels) {
    let bestIndex = -1;
    let bestDist = Infinity;
    vertices.forEach((v, i) => {
      const d = Math.hypot(v.x - label.cx, v.y - label.cy);
      if (d < bestDist) {
        bestDist = d;
        bestIndex = i;
      }
    });
    if (bestIndex < 0 || bestDist > LABEL_RADIUS) {
      unboundLabels.push(label);
      continue;
    }
    const prev = best.get(label.char);
    if (!prev || bestDist < prev.dist) best.set(label.char, { index: bestIndex, dist: bestDist });
  }
  for (const [char, binding] of best) {
    const vertex = vertices[binding.index]!;
    vertex.labels.push(char);
    graph[char] = vertex;
  }
  for (const vertex of vertices) vertex.labels.sort();
  return { graph, vertices, unboundLabels };
}
