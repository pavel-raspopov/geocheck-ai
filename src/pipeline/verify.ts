import { EPS_DEFAULT, MESSAGE_DECIMALS } from './constants';
import type { Point, VerifyInput, VerifyResult, Vertex } from './types';

const DEG = 180 / Math.PI;

function dist(a: Point, b: Point): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function resolve(graph: Record<string, Vertex>, label: string): Point | undefined {
  const vertex = graph[label];
  return vertex ? { x: vertex.x, y: vertex.y } : undefined;
}

/**
 * Разрешает метки правила в точки графа. Если метки нет — возвращает мягкую
 * ошибку (ТЗ §4) вместо исключения: `[Status: Error] Точка X не найдена на чертеже`.
 */
function resolveAll(
  graph: Record<string, Vertex>,
  labels: string[],
  epsilon: number,
): { points: Record<string, Point> } | VerifyResult {
  const points: Record<string, Point> = {};
  for (const label of labels) {
    const p = resolve(graph, label);
    if (!p) {
      return {
        status: 'Error',
        message: `[Status: Error] Точка ${label} не найдена на чертеже`,
        epsilon,
      };
    }
    points[label] = p;
  }
  return { points };
}

/** Угол между векторами BA и BC (общее начало в B), в градусах [0..180]. */
function cornerAngleDeg(ba: Point, bc: Point): number {
  const dot = ba.x * bc.x + ba.y * bc.y;
  const la = Math.hypot(ba.x, ba.y);
  const lb = Math.hypot(bc.x, bc.y);
  const cos = la === 0 || lb === 0 ? 0 : dot / (la * lb);
  return Math.acos(Math.max(-1, Math.min(1, cos))) * DEG;
}

/** Угол между прямыми AB и CD, в градусах [0..90]. */
function lineAngleDeg(ab: Point, cd: Point): number {
  const cross = ab.x * cd.y - ab.y * cd.x;
  const la = Math.hypot(ab.x, ab.y);
  const lb = Math.hypot(cd.x, cd.y);
  const sin = la === 0 || lb === 0 ? 0 : cross / (la * lb);
  return Math.abs(Math.asin(Math.max(-1, Math.min(1, sin))) * DEG);
}

function verifyPerpendicular(graph: Record<string, Vertex>, epsilon: number): VerifyResult {
  const found = resolveAll(graph, ['A', 'B', 'C'], epsilon);
  if ('points' in found) {
    const { points } = found;
    const A = points.A!;
    const B = points.B!;
    const C = points.C!;
    const angle = cornerAngleDeg({ x: A.x - B.x, y: A.y - B.y }, { x: C.x - B.x, y: C.y - B.y });
    const deviation = Math.abs(angle - 90);
    if (deviation <= epsilon) {
      return {
        status: 'Success',
        message: `Верно: угол ABC = ${angle.toFixed(MESSAGE_DECIMALS)}° (в пределах ε = ${epsilon.toFixed(MESSAGE_DECIMALS)})`,
        deviation,
        epsilon,
      };
    }
    return {
      status: 'Fail',
      message: `Ошибка: Угол ABC на рисунке равен ${angle.toFixed(MESSAGE_DECIMALS)}°, отклонение составляет ${deviation.toFixed(MESSAGE_DECIMALS)}°`,
      deviation,
      epsilon,
    };
  }
  return found;
}

function verifyParallel(graph: Record<string, Vertex>, epsilon: number): VerifyResult {
  const found = resolveAll(graph, ['A', 'B', 'C', 'D'], epsilon);
  if ('points' in found) {
    const { points } = found;
    const A = points.A!;
    const B = points.B!;
    const C = points.C!;
    const D = points.D!;
    const angle = lineAngleDeg({ x: B.x - A.x, y: B.y - A.y }, { x: D.x - C.x, y: D.y - C.y });
    if (angle <= epsilon) {
      return {
        status: 'Success',
        message: `Верно: прямые AB и CD параллельны (угол между ними ${angle.toFixed(MESSAGE_DECIMALS)}°)`,
        deviation: angle,
        epsilon,
      };
    }
    return {
      status: 'Fail',
      message: `Ошибка: Прямые AB и CD не параллельны: угол между ними ${angle.toFixed(MESSAGE_DECIMALS)}°`,
      deviation: angle,
      epsilon,
    };
  }
  return found;
}

function verifyEqualSegments(graph: Record<string, Vertex>, epsilon: number): VerifyResult {
  const found = resolveAll(graph, ['A', 'B', 'C', 'D'], epsilon);
  if ('points' in found) {
    const { points } = found;
    const A = points.A!;
    const B = points.B!;
    const C = points.C!;
    const D = points.D!;
    const lenAB = dist(A, B);
    const lenCD = dist(C, D);
    const deviation = Math.abs(lenAB - lenCD);
    if (deviation <= epsilon) {
      return {
        status: 'Success',
        message: `Верно: |AB| = ${lenAB.toFixed(MESSAGE_DECIMALS)} px = |CD|`,
        deviation,
        epsilon,
      };
    }
    return {
      status: 'Fail',
      message: `Ошибка: Длина AB = ${lenAB.toFixed(MESSAGE_DECIMALS)} px, длина CD = ${lenCD.toFixed(MESSAGE_DECIMALS)} px, отклонение составляет ${deviation.toFixed(MESSAGE_DECIMALS)} px`,
      deviation,
      epsilon,
    };
  }
  return found;
}

function verifyPointOnSegment(graph: Record<string, Vertex>, epsilon: number): VerifyResult {
  const found = resolveAll(graph, ['M', 'A', 'B'], epsilon);
  if ('points' in found) {
    const { points } = found;
    const M = points.M!;
    const A = points.A!;
    const B = points.B!;
    // Неравенство треугольника: (AM + MB) − AB ≤ ε гарантирует,
    // что M лежит на отрезке строго между A и B (ТЗ §3.3).
    const slack = dist(M, A) + dist(M, B) - dist(A, B);
    if (slack <= epsilon) {
      return {
        status: 'Success',
        message: 'Верно: точка M принадлежит отрезку AB',
        deviation: Math.max(0, slack),
        epsilon,
      };
    }
    return {
      status: 'Fail',
      message: `Ошибка: Точка M не лежит на отрезке AB (смещение ${slack.toFixed(MESSAGE_DECIMALS)} px)`,
      deviation: Math.max(0, slack),
      epsilon,
    };
  }
  return found;
}

/** Верификация выбранного правила по графу вершин с погрешностью ε. */
export function verify(input: VerifyInput): VerifyResult {
  const epsilon = input.epsilon ?? EPS_DEFAULT;
  switch (input.rule) {
    case 'perpendicular':
      return verifyPerpendicular(input.graph, epsilon);
    case 'parallel':
      return verifyParallel(input.graph, epsilon);
    case 'equal-segments':
      return verifyEqualSegments(input.graph, epsilon);
    case 'point-on-segment':
      return verifyPointOnSegment(input.graph, epsilon);
    default:
      return {
        status: 'Error',
        message: '[Status: Error] Неизвестное правило',
        epsilon,
      };
  }
}
