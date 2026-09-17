/** Геометрические хелперы пайплайна (общие для verify v1 и rules-engine v2). */

import type { Point, VerifyResult, Vertex } from './types';

export function dist(a: Point, b: Point): number {
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
export function resolveAll(
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
export function cornerAngleDeg(ba: Point, bc: Point): number {
  const dot = ba.x * bc.x + ba.y * bc.y;
  const la = Math.hypot(ba.x, ba.y);
  const lb = Math.hypot(bc.x, bc.y);
  const cos = la === 0 || lb === 0 ? 0 : dot / (la * lb);
  return Math.acos(Math.max(-1, Math.min(1, cos))) * (180 / Math.PI);
}

/** Угол между прямыми AB и CD, в градусах [0..90]. */
export function lineAngleDeg(ab: Point, cd: Point): number {
  const cross = ab.x * cd.y - ab.y * cd.x;
  const la = Math.hypot(ab.x, ab.y);
  const lb = Math.hypot(cd.x, cd.y);
  const sin = la === 0 || lb === 0 ? 0 : cross / (la * lb);
  return Math.abs(Math.asin(Math.max(-1, Math.min(1, sin))) * (180 / Math.PI));
}

/** Расстояние от точки M до прямой AB, px. */
export function pointLineDistance(m: Point, a: Point, b: Point): number {
  const ab = { x: b.x - a.x, y: b.y - a.y };
  const len = Math.hypot(ab.x, ab.y);
  if (len === 0) return dist(m, a);
  const cross = ab.x * (m.y - a.y) - ab.y * (m.x - a.x);
  return Math.abs(cross) / len;
}