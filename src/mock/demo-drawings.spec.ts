import { describe, expect, it } from 'vitest';
import { verify } from '../pipeline/verify';
import type { Rule } from '../pipeline/types';
import { parseTask } from '../pipeline/rules/parse';
import { evaluateRules } from '../pipeline/rules/rules-engine';
import { DEMO_DRAWINGS, DEMO_TASK_TEXT, IDEAL_DEMO, TILTED_DEMO } from './demo-drawings';

const ALL_RULES: readonly Rule[] = [
  'perpendicular',
  'parallel',
  'equal-segments',
  'point-on-segment',
];

describe('DEMO_TASK_TEXT (фича 11)', () => {
  it('парсится в 4 правила и точки A,B,C,D,M', () => {
    const parsed = parseTask(DEMO_TASK_TEXT);
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(parsed.task.relations).toEqual([
      { kind: 'angle', angle: 'ABC', degrees: 90 },
      { kind: 'parallel', a: 'AB', b: 'CD' },
      { kind: 'equal', a: 'AB', b: 'CD' },
      { kind: 'on-segment', point: 'M', segment: 'AB' },
    ]);
    expect(parsed.task.points).toEqual(['A', 'B', 'C', 'D', 'M']);
  });

  it('идеальная сцена: все правила Success; наклонная: Fail', () => {
    const parsed = parseTask(DEMO_TASK_TEXT);
    if (!parsed.ok) throw new Error('demo text must parse');
    expect(evaluateRules(IDEAL_DEMO.graph, parsed.task.relations, 3).verdict).toBe('Success');
    expect(evaluateRules(TILTED_DEMO.graph, parsed.task.relations, 3).verdict).toBe('Fail');
  });
});

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
