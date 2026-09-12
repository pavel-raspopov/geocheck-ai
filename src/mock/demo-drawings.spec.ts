import { describe, expect, it } from 'vitest';
import { verify } from '../pipeline/verify';
import type { Rule } from '../pipeline/types';
import { DEMO_DRAWINGS, IDEAL_DEMO, TILTED_DEMO } from './demo-drawings';

const ALL_RULES: readonly Rule[] = [
  'perpendicular',
  'parallel',
  'equal-segments',
  'point-on-segment',
];

describe('demo-drawings', () => {
  it('идеальный чертёж проходит все 4 правила при ε = 3.0', () => {
    for (const rule of ALL_RULES) {
      expect(verify({ graph: IDEAL_DEMO.graph, rule, epsilon: 3 }).status).toBe('Success');
    }
  });

  it('угол ABC идеального чертежа равен ровно 90° (отклонение 0)', () => {
    const r = verify({ graph: IDEAL_DEMO.graph, rule: 'perpendicular', epsilon: 3 });
    expect(r.status).toBe('Success');
    expect(r.deviation ?? -1).toBeCloseTo(0, 6);
  });

  it('сцена с отклонениями проваливает перпендикулярность при ε = 3.0 с текстом ТЗ', () => {
    const r = verify({ graph: TILTED_DEMO.graph, rule: 'perpendicular', epsilon: 3 });
    expect(r.status).toBe('Fail');
    expect(r.message).toBe('Ошибка: Угол ABC на рисунке равен 84.12°, отклонение составляет 5.88°');
  });

  it('сцена с отклонениями проваливает принадлежность точки (M за точкой B)', () => {
    const r = verify({ graph: TILTED_DEMO.graph, rule: 'point-on-segment', epsilon: 3 });
    expect(r.status).toBe('Fail');
    expect(r.deviation ?? 0).toBeGreaterThan(3);
  });

  it('сцена с отклонениями оставляет параллельность и равенство отрезков верными', () => {
    for (const rule of ['parallel', 'equal-segments'] as readonly Rule[]) {
      expect(verify({ graph: TILTED_DEMO.graph, rule, epsilon: 3 }).status).toBe('Success');
    }
  });

  it('каждая буква-метка чертежей присутствует как вершина графа', () => {
    for (const demo of DEMO_DRAWINGS) {
      for (const l of demo.labels) {
        expect(demo.graph[l.char]).toBeDefined();
      }
    }
  });
});
