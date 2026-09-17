import { describe, expect, it } from 'vitest';
import { formatRelation, formatTaskSummary } from './relation-format';
import type { ParsedTask, Relation } from '../pipeline/rules/types';

describe('formatRelation', () => {
  const cases: readonly [Relation, string][] = [
    [{ kind: 'angle', angle: 'ABC', degrees: 90 }, '∠ABC = 90°'],
    [{ kind: 'parallel', a: 'AB', b: 'CD' }, 'AB ∥ CD'],
    [{ kind: 'equal', a: 'AB', b: 'CD' }, '|AB| = |CD|'],
    [{ kind: 'on-segment', point: 'M', segment: 'AB' }, 'M ∈ AB'],
    [{ kind: 'median', cevian: 'BK', side: 'AC' }, 'BK — медиана к стороне AC'],
    [{ kind: 'bisector', cevian: 'BM', angle: 'ABC' }, 'BM — биссектриса угла ABC'],
    [{ kind: 'height', cevian: 'BM', side: 'AC' }, 'BM — высота к стороне AC'],
  ];
  for (const [relation, expected] of cases) {
    it(JSON.stringify(relation), () => expect(formatRelation(relation)).toBe(expected));
  }
});

describe('formatTaskSummary', () => {
  it('правила и «дано» по строкам', () => {
    const task: ParsedTask = {
      points: ['A', 'B', 'C'],
      relations: [
        { kind: 'angle', angle: 'ABC', degrees: 100 },
        { kind: 'bisector', cevian: 'BM', angle: 'ABC' },
      ],
      givens: ['AC = 16 см'],
      source: 'parser',
    };
    expect(formatTaskSummary(task)).toEqual({
      rules: ['∠ABC = 100°', 'BM — биссектриса угла ABC'],
      givens: ['AC = 16 см'],
    });
  });

  it('пустые списки — пустые массивы', () => {
    const task: ParsedTask = { points: [], relations: [], givens: [], source: 'gemini' };
    expect(formatTaskSummary(task)).toEqual({ rules: [], givens: [] });
  });
});
