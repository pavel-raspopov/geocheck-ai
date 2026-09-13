/** Стадия 4 пайплайна (ТЗ §2): сборка графа — вершины из отрезков + привязка меток. */
import {
  INTERSECTION_DENOM_EPS,
  LABEL_RADIUS,
  ON_SEGMENT_TOLERANCE,
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
  const candidates: Point[] = [];
  for (const s of segments) {
    candidates.push({ x: s.x1, y: s.y1 }, { x: s.x2, y: s.y2 });
  }
  for (let i = 0; i < segments.length; i++) {
    for (let j = i + 1; j < segments.length; j++) {
      const a = segments[i]!;
      const b = segments[j]!;
      const p = lineIntersection(a, b);
      if (!p) continue;
      if (
        pointSegmentDistance(p, a) <= ON_SEGMENT_TOLERANCE &&
        pointSegmentDistance(p, b) <= ON_SEGMENT_TOLERANCE
      ) {
        candidates.push(p);
      }
    }
  }
  return candidates;
}

/** Кластер кандидатов: representative = первый участник, координаты копятся для центроида. */
interface Cluster {
  rep: Point;
  sumX: number;
  sumY: number;
  n: number;
}

/** Жадная кластеризация по радиусу VERTEX_MERGE_RADIUS; детерминирована сортировкой входа. */
function clusterPoints(points: Point[]): Point[] {
  const sorted = [...points].sort((a, b) => a.y - b.y || a.x - b.x);
  const clusters: Cluster[] = [];
  for (const p of sorted) {
    const target = clusters.find(
      (c) => Math.hypot(c.rep.x - p.x, c.rep.y - p.y) <= VERTEX_MERGE_RADIUS,
    );
    if (target) {
      target.sumX += p.x;
      target.sumY += p.y;
      target.n += 1;
    } else {
      clusters.push({ rep: p, sumX: p.x, sumY: p.y, n: 1 });
    }
  }
  return clusters.map((c) => ({ x: c.sumX / c.n, y: c.sumY / c.n }));
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
