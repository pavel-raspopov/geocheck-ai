/** Rule engine v2: оценка списка Relation[] по графу вершин (Phase 6, фича 09). */

import { EPS_DEFAULT, MESSAGE_DECIMALS } from '../constants';
import { cornerAngleDeg, dist, lineAngleDeg, pointLineDistance, resolveAll } from '../geometry';
import type { Point, VerifyResult, VerifyStatus, Vertex } from '../types';
import type { AngleName, Relation, Segment } from './types';

/** Результат проверки одного правила: исходный relation + вердикт. */
export interface RuleOutcome {
  readonly relation: Relation;
  readonly result: VerifyResult;
}

/** Итог мульт-проверки: список результатов + агрегированный вердикт. */
export interface RulesEvaluation {
  readonly results: RuleOutcome[];
  readonly verdict: VerifyStatus;
}

const D = MESSAGE_DECIMALS;
const f = (v: number): string => v.toFixed(D);
/** Вектор из точки a в точку b. */
const vec = (a: Point, b: Point): Point => ({ x: b.x - a.x, y: b.y - a.y });
const seg = (a: string, b: string): Segment => `${a}${b}` as Segment;

/* --- Параметризованные под-проверки (принимают уже разрешённые точки) --- */

function checkAngle(
  points: Record<string, Point>,
  angle: AngleName,
  degrees: number,
  epsilon: number,
): VerifyResult {
  const a = points[angle.charAt(0)]!;
  const b = points[angle.charAt(1)]!;
  const c = points[angle.charAt(2)]!;
  const measured = cornerAngleDeg(vec(b, a), vec(b, c));
  const deviation = Math.abs(measured - degrees);
  if (deviation <= epsilon) {
    return {
      status: 'Success',
      message: `Верно: угол ${angle} = ${f(measured)}° (в пределах ε = ${f(epsilon)})`,
      deviation,
      epsilon,
    };
  }
  return {
    status: 'Fail',
    message: `Ошибка: Угол ${angle} на рисунке равен ${f(measured)}°, отклонение составляет ${f(deviation)}°`,
    deviation,
    epsilon,
  };
}

function checkParallel(
  points: Record<string, Point>,
  a: Segment,
  b: Segment,
  epsilon: number,
): VerifyResult {
  const measured = lineAngleDeg(
    vec(points[a.charAt(0)]!, points[a.charAt(1)]!),
    vec(points[b.charAt(0)]!, points[b.charAt(1)]!),
  );
  if (measured <= epsilon) {
    return {
      status: 'Success',
      message: `Верно: прямые ${a} и ${b} параллельны (угол между ними ${f(measured)}°)`,
      deviation: measured,
      epsilon,
    };
  }
  return {
    status: 'Fail',
    message: `Ошибка: Прямые ${a} и ${b} не параллельны: угол между ними ${f(measured)}°`,
    deviation: measured,
    epsilon,
  };
}

function checkEqualSegments(
  points: Record<string, Point>,
  a: Segment,
  b: Segment,
  epsilon: number,
): VerifyResult {
  const lenA = dist(points[a.charAt(0)]!, points[a.charAt(1)]!);
  const lenB = dist(points[b.charAt(0)]!, points[b.charAt(1)]!);
  const deviation = Math.abs(lenA - lenB);
  if (deviation <= epsilon) {
    return {
      status: 'Success',
      message: `Верно: |${a}| = ${f(lenA)} px = |${b}|`,
      deviation,
      epsilon,
    };
  }
  return {
    status: 'Fail',
    message: `Ошибка: Длина ${a} = ${f(lenA)} px, длина ${b} = ${f(lenB)} px, отклонение составляет ${f(deviation)} px`,
    deviation,
    epsilon,
  };
}

/** Неравенство треугольника: (AM + MB) − AB ≤ ε ⇒ M на отрезке AB (ТЗ §3.3). */
function checkOnSegment(
  points: Record<string, Point>,
  point: string,
  segment: Segment,
  epsilon: number,
): VerifyResult {
  const m = points[point.charAt(0)]!;
  const a = points[segment.charAt(0)]!;
  const b = points[segment.charAt(1)]!;
  const slack = dist(m, a) + dist(m, b) - dist(a, b);
  if (slack <= epsilon) {
    return {
      status: 'Success',
      message: `Верно: точка ${point} принадлежит отрезку ${segment}`,
      deviation: Math.max(0, slack),
      epsilon,
    };
  }
  return {
    status: 'Fail',
    message: `Ошибка: Точка ${point} не лежит на отрезке ${segment} (смещение ${f(slack)} px)`,
    deviation: Math.max(0, slack),
    epsilon,
  };
}

/** Точка на ПРЯМОЙ стороны (основание высоты может лежать вне отрезка). */
function checkOnLine(
  points: Record<string, Point>,
  point: string,
  segment: Segment,
  epsilon: number,
): VerifyResult {
  const m = points[point]!;
  const a = points[segment.charAt(0)]!;
  const b = points[segment.charAt(1)]!;
  const d = pointLineDistance(m, a, b);
  if (d <= epsilon) {
    return {
      status: 'Success',
      message: `Верно: точка ${point} лежит на прямой ${segment}`,
      deviation: d,
      epsilon,
    };
  }
  return {
    status: 'Fail',
    message: `Ошибка: Точка ${point} не лежит на прямой ${segment} (расстояние ${f(d)} px)`,
    deviation: d,
    epsilon,
  };
}

function checkMedian(
  points: Record<string, Point>,
  cevian: Segment,
  side: Segment,
  epsilon: number,
): VerifyResult {
  const end = cevian.charAt(1);
  const vertex = cevian.charAt(0);
  const onSide = checkOnSegment(points, end, side, epsilon);
  if (onSide.status !== 'Success') return onSide;
  const halves = checkEqualSegments(points, seg(side.charAt(0), end), seg(end, side.charAt(1)), epsilon);
  if (halves.status !== 'Success') return halves;
  // Имя треугольника: конец стороны + вершина чевианы + другой конец стороны (B-медиана в ABC → ABC).
  const triangle = `${side.charAt(0)}${vertex}${side.charAt(1)}`;
  return {
    status: 'Success',
    message: `Верно: ${cevian} — медиана треугольника ${triangle}`,
    deviation: Math.max(onSide.deviation ?? 0, halves.deviation ?? 0),
    epsilon,
  };
}

function checkBisector(
  points: Record<string, Point>,
  cevian: Segment,
  angle: AngleName,
  epsilon: number,
): VerifyResult {
  const vertex = angle.charAt(1);
  const armA = angle.charAt(0);
  const armC = angle.charAt(2);
  const end = cevian.charAt(1);
  const b = points[vertex]!;
  const m1 = cornerAngleDeg(vec(b, points[armA]!), vec(b, points[end]!));
  const m2 = cornerAngleDeg(vec(b, points[end]!), vec(b, points[armC]!));
  const deviation = Math.abs(m1 - m2);
  const near = `∠${armA}${vertex}${end}`;
  const far = `∠${end}${vertex}${armC}`;
  if (deviation <= epsilon) {
    return {
      status: 'Success',
      message: `Верно: ${cevian} — биссектриса угла ${angle} (${near} = ${f(m1)}°, ${far} = ${f(m2)}°)`,
      deviation,
      epsilon,
    };
  }
  return {
    status: 'Fail',
    message: `Ошибка: ${cevian} не является биссектрисой угла ${angle}: ${near} = ${f(m1)}°, ${far} = ${f(m2)}°, отклонение составляет ${f(deviation)}°`,
    deviation,
    epsilon,
  };
}

function checkHeight(
  points: Record<string, Point>,
  cevian: Segment,
  side: Segment,
  epsilon: number,
): VerifyResult {
  const start = cevian.charAt(0);
  const end = cevian.charAt(1);
  const perp = lineAngleDeg(
    vec(points[start]!, points[end]!),
    vec(points[side.charAt(0)]!, points[side.charAt(1)]!),
  );
  const perpDeviation = Math.abs(perp - 90);
  if (perpDeviation > epsilon) {
    return {
      status: 'Fail',
      message: `Ошибка: ${cevian} не перпендикулярна ${side}: угол ${f(perp)}°`,
      deviation: perpDeviation,
      epsilon,
    };
  }
  const onLine = checkOnLine(points, end, side, epsilon);
  if (onLine.status !== 'Success') return onLine;
  return {
    status: 'Success',
    message: `Верно: ${cevian} — высота к ${side}`,
    deviation: Math.max(perpDeviation, onLine.deviation ?? 0),
    epsilon,
  };
}

/* --- Диспетчер и агрегация --- */

function evaluateOne(graph: Record<string, Vertex>, relation: Relation, epsilon: number): VerifyResult {
  const need = (labels: string[]): { points: Record<string, Point> } | VerifyResult =>
    resolveAll(graph, labels, epsilon);
  switch (relation.kind) {
    case 'angle': {
      const a = relation.angle;
      const found = need([a.charAt(0), a.charAt(1), a.charAt(2)]);
      return 'points' in found ? checkAngle(found.points, a, relation.degrees, epsilon) : found;
    }
    case 'parallel': {
      const found = need([relation.a.charAt(0), relation.a.charAt(1), relation.b.charAt(0), relation.b.charAt(1)]);
      return 'points' in found ? checkParallel(found.points, relation.a, relation.b, epsilon) : found;
    }
    case 'equal': {
      const found = need([relation.a.charAt(0), relation.a.charAt(1), relation.b.charAt(0), relation.b.charAt(1)]);
      return 'points' in found ? checkEqualSegments(found.points, relation.a, relation.b, epsilon) : found;
    }
    case 'on-segment': {
      const found = need([relation.point, relation.segment.charAt(0), relation.segment.charAt(1)]);
      return 'points' in found
        ? checkOnSegment(found.points, relation.point, relation.segment, epsilon)
        : found;
    }
    case 'median': {
      const found = need([
        relation.cevian.charAt(0), relation.cevian.charAt(1),
        relation.side.charAt(0), relation.side.charAt(1),
      ]);
      return 'points' in found ? checkMedian(found.points, relation.cevian, relation.side, epsilon) : found;
    }
    case 'bisector': {
      const a = relation.angle;
      const found = need([a.charAt(0), a.charAt(1), a.charAt(2), relation.cevian.charAt(1)]);
      return 'points' in found ? checkBisector(found.points, relation.cevian, a, epsilon) : found;
    }
    case 'height': {
      const found = need([
        relation.cevian.charAt(0), relation.cevian.charAt(1),
        relation.side.charAt(0), relation.side.charAt(1),
      ]);
      return 'points' in found ? checkHeight(found.points, relation.cevian, relation.side, epsilon) : found;
    }
  }
}

/**
 * Мульт-проверка: оценивает все подтверждённые правила по графу (ТЗ §5, v2).
 * Агрегация: Success ⇔ все Success; любой Error → Error (непроверяемое
 * состояние, доминирует над Fail); иначе — Fail.
 */
export function evaluateRules(
  graph: Record<string, Vertex>,
  relations: readonly Relation[],
  epsilon: number = EPS_DEFAULT,
): RulesEvaluation {
  const results: RuleOutcome[] = relations.map((relation) => ({
    relation,
    result: evaluateOne(graph, relation, epsilon),
  }));
  let verdict: VerifyStatus = 'Success';
  for (const { result } of results) {
    if (result.status === 'Error') {
      verdict = 'Error';
      break;
    }
    if (result.status === 'Fail') verdict = 'Fail';
  }
  return { results, verdict };
}

