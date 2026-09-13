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

  it('разность углов ≤ 5° при близости → слияние', () => {
    const dy = 100 * Math.tan((3 * Math.PI) / 180); // наклон ровно 3°
    const result = deduplicateSegments([seg(100, 100, 200, 100), seg(100, 103, 200, 103 + dy)]);
    expect(result).toHaveLength(1);
  });

  it('разность углов > 5° → не сливаются', () => {
    const dy = 100 * Math.tan((7 * Math.PI) / 180); // наклон ровно 7°
    const result = deduplicateSegments([seg(100, 100, 200, 100), seg(100, 103, 200, 103 + dy)]);
    expect(result).toHaveLength(2);
  });

  it('коллинеарные фрагменты с зазором ≤ 7 px → один отрезок по крайним точкам', () => {
    const result = deduplicateSegments([seg(50, 100, 120, 100), seg(126, 100, 200, 100)]);
    expect(result).toHaveLength(1);
    const merged = result[0]!;
    expect(merged).toBeDefined();
    const xs = [merged.x1, merged.x2].sort((a, b) => a - b);
    expect(xs[0]).toBeCloseTo(50, 6);
    expect(xs[1]).toBeCloseTo(200, 6);
  });

  it('транзитивная цепочка A~B, B~C (A!~C) → один кластер', () => {
    const result = deduplicateSegments([
      seg(100, 100, 200, 100),
      seg(100, 104, 200, 104),
      seg(100, 108, 200, 108),
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
    const result = deduplicateSegments([
      seg(0, 0, 30, 0),
      seg(100, 100, 200, 100),
      seg(0, 200, 60, 200),
    ]);
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
