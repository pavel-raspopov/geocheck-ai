import { describe, expect, it } from 'vitest';
import { evaluateRules } from './rules-engine';
import type { Relation } from './types';
import type { Vertex } from '../types';

/** Строит граф «метка → вершина» из координат [x, y] (экранные координаты, ось y вниз). */
function graph(map: Record<string, [number, number]>): Record<string, Vertex> {
  const out: Record<string, Vertex> = {};
  for (const [key, [x, y]] of Object.entries(map)) {
    out[key] = { x, y, labels: [key] };
  }
  return out;
}

/** Точка на единичной окружности радиуса 100 из начала координат (для углов). */
const deg = (d: number): [number, number] => [
  100 * Math.cos((d * Math.PI) / 180),
  100 * Math.sin((d * Math.PI) / 180),
];

describe('evaluateRules: angle (имя угла в сообщении — решение 2026-09-17)', () => {
  it('∠ABC = 100° нарисован точно → Success', () => {
    const { results, verdict } = evaluateRules(graph({ A: deg(100), B: [0, 0], C: deg(0) }), [
      { kind: 'angle', angle: 'ABC', degrees: 100 },
    ]);
    expect(results[0]!.result.status).toBe('Success');
    expect(results[0]!.result.message).toBe('Верно: угол ABC = 100.00° (в пределах ε = 3.00)');
    expect(verdict).toBe('Success');
  });

  it('угол 84.12° при N=90, ε=3 → Fail с точным текстом (с именем угла)', () => {
    const { results, verdict } = evaluateRules(
      graph({ A: deg(84.12), B: [0, 0], C: deg(0) }),
      [{ kind: 'angle', angle: 'ABC', degrees: 90 }],
      3.0,
    );
    expect(results[0]!.result.status).toBe('Fail');
    expect(results[0]!.result.message).toBe(
      'Ошибка: Угол ABC на рисунке равен 84.12°, отклонение составляет 5.88°',
    );
    expect(verdict).toBe('Fail');
  });
});

describe('evaluateRules: базовые правила (parallel / equal / on-segment)', () => {
  it('parallel: параллельные отрезки → Success', () => {
    const { verdict } = evaluateRules(graph({ A: [0, 0], B: [100, 0], C: [0, 40], D: [100, 40] }), [
      { kind: 'parallel', a: 'AB', b: 'CD' },
    ]);
    expect(verdict).toBe('Success');
  });

  it('equal: разная длина → Fail с текстом v1', () => {
    const { results } = evaluateRules(
      graph({ A: [0, 0], B: [100, 0], C: [200, 50], D: [250, 50] }),
      [{ kind: 'equal', a: 'AB', b: 'CD' }],
      3.0,
    );
    expect(results[0]!.result.status).toBe('Fail');
    expect(results[0]!.result.message).toBe(
      'Ошибка: Длина AB = 100.00 px, длина CD = 50.00 px, отклонение составляет 50.00 px',
    );
  });

  it('on-segment: M за точкой B → Fail (ТЗ §5, граничный тест)', () => {
    const { results } = evaluateRules(
      graph({ M: [140, 0], A: [0, 0], B: [100, 0] }),
      [{ kind: 'on-segment', point: 'M', segment: 'AB' }],
      3.0,
    );
    expect(results[0]!.result.status).toBe('Fail');
    expect(results[0]!.result.message).toBe(
      'Ошибка: Точка M не лежит на отрезке AB (смещение 80.00 px)',
    );
  });
});

describe('evaluateRules: median (on-segment + equal половин, один результат)', () => {
  const MED: Relation = { kind: 'median', cevian: 'BK', side: 'AC' };

  it('K — середина AC → Success с именем треугольника', () => {
    const { results, verdict } = evaluateRules(
      graph({ A: [0, 0], C: [100, 0], B: [50, 80], K: [50, 0] }),
      [MED],
    );
    expect(results[0]!.result.status).toBe('Success');
    expect(results[0]!.result.message).toBe('Верно: BK — медиана треугольника ABC');
    expect(verdict).toBe('Success');
  });

  it('K не середина (AK ≠ KC) → Fail от под-проверки equal', () => {
    const { results } = evaluateRules(
      graph({ A: [0, 0], C: [100, 0], B: [50, 80], K: [30, 0] }),
      [MED],
      3.0,
    );
    expect(results[0]!.result.status).toBe('Fail');
    expect(results[0]!.result.message).toBe(
      'Ошибка: Длина AK = 30.00 px, длина KC = 70.00 px, отклонение составляет 40.00 px',
    );
  });

  it('K вне стороны AC → Fail от под-проверки on-segment', () => {
    const { results } = evaluateRules(
      graph({ A: [0, 0], C: [100, 0], B: [50, 80], K: [140, 0] }),
      [MED],
      3.0,
    );
    expect(results[0]!.result.status).toBe('Fail');
    expect(results[0]!.result.message).toBe(
      'Ошибка: Точка K не лежит на отрезке AC (смещение 80.00 px)',
    );
  });
});

describe('evaluateRules: bisector (|∠ABM − ∠MBC| ≤ ε)', () => {
  const BIS: Relation = { kind: 'bisector', cevian: 'BM', angle: 'ABC' };

  it('BM делит ∠ABC пополам → Success', () => {
    const { results, verdict } = evaluateRules(
      graph({ A: deg(0), B: [0, 0], C: deg(50), M: deg(25) }),
      [BIS],
    );
    expect(results[0]!.result.status).toBe('Success');
    expect(results[0]!.result.message).toBe(
      'Верно: BM — биссектриса угла ABC (∠ABM = 25.00°, ∠MBC = 25.00°)',
    );
    expect(verdict).toBe('Success');
  });

  it('BM смещена → Fail с обеими мерами и отклонением', () => {
    const { results } = evaluateRules(
      graph({ A: deg(0), B: [0, 0], C: deg(50), M: deg(40) }),
      [BIS],
      3.0,
    );
    expect(results[0]!.result.status).toBe('Fail');
    expect(results[0]!.result.message).toBe(
      'Ошибка: BM не является биссектрисой угла ABC: ∠ABM = 40.00°, ∠MBC = 10.00°, отклонение составляет 30.00°',
    );
  });
});

describe('evaluateRules: height (⊥ + точка на прямой стороны)', () => {
  const H: Relation = { kind: 'height', cevian: 'BM', side: 'AC' };

  it('BM ⊥ AC, M на прямой AC → Success', () => {
    const { results, verdict } = evaluateRules(
      graph({ A: [0, 0], C: [100, 0], B: [50, 80], M: [50, 0] }),
      [H],
    );
    expect(results[0]!.result.status).toBe('Success');
    expect(results[0]!.result.message).toBe('Верно: BM — высота к AC');
    expect(verdict).toBe('Success');
  });

  it('BM не перпендикулярна → Fail от под-проверки перпендикулярности', () => {
    const { results } = evaluateRules(
      graph({ A: [0, 0], C: [100, 0], B: [50, 80], M: [60, 0] }),
      [H],
      3.0,
    );
    expect(results[0]!.result.status).toBe('Fail');
    expect(results[0]!.result.message).toMatch(
      /^Ошибка: BM не перпендикулярна AC: угол \d+\.\d{2}°$/,
    );
    expect(results[0]!.result.deviation).toBeGreaterThan(3.0);
  });

  it('основание вне прямой (M над AC) → Fail от под-проверки on-line', () => {
    const { results } = evaluateRules(
      graph({ A: [0, 0], C: [100, 0], B: [50, 80], M: [50, 10] }),
      [H],
      3.0,
    );
    expect(results[0]!.result.status).toBe('Fail');
    expect(results[0]!.result.message).toBe(
      'Ошибка: Точка M не лежит на прямой AC (расстояние 10.00 px)',
    );
  });
});

describe('evaluateRules: мягкие ошибки и агрегация', () => {
  it('ненайденная точка → Error с точным текстом ТЗ', () => {
    const { results, verdict } = evaluateRules(graph({ A: [0, 0], B: [0, 0] }), [
      { kind: 'angle', angle: 'ABD', degrees: 90 },
    ]);
    expect(results[0]!.result.status).toBe('Error');
    expect(results[0]!.result.message).toBe('[Status: Error] Точка D не найдена на чертеже');
    expect(verdict).toBe('Error');
  });

  it('Success + Fail → вердикт Fail', () => {
    const { verdict } = evaluateRules(
      graph({
        A: [0, 0],
        B: [100, 0],
        C: [0, 40],
        D: [100, 40],
        E: [0, 0],
        F: [100, 0],
        G: [200, 50],
        H: [250, 50],
      }),
      [
        { kind: 'parallel', a: 'AB', b: 'CD' },
        { kind: 'equal', a: 'EF', b: 'GH' },
      ],
      3.0,
    );
    expect(verdict).toBe('Fail');
  });

  it('Fail + Error → Error доминирует', () => {
    const { verdict } = evaluateRules(
      graph({ A: [0, 0], B: [100, 0], C: [0, 40], D: [100, 90], M: [140, 0] }),
      [
        { kind: 'parallel', a: 'AB', b: 'CD' },
        { kind: 'on-segment', point: 'M', segment: 'AB' },
        { kind: 'angle', angle: 'ABZ', degrees: 90 },
      ],
      3.0,
    );
    expect(verdict).toBe('Error');
  });

  it('пустой relations (givens-only) → Success без результатов', () => {
    const { results, verdict } = evaluateRules(graph({ A: [0, 0] }), []);
    expect(results).toEqual([]);
    expect(verdict).toBe('Success');
  });

  it('ε по умолчанию = 3.0 (EPS_DEFAULT)', () => {
    const { results } = evaluateRules(graph({ A: deg(87.5), B: [0, 0], C: deg(0) }), [
      { kind: 'angle', angle: 'ABC', degrees: 90 },
    ]);
    expect(results[0]!.result.epsilon).toBe(3.0);
  });

  it('каждый результат несёт своё relation', () => {
    const rel: Relation = { kind: 'equal', a: 'AB', b: 'CD' };
    const { results } = evaluateRules(
      graph({ A: [0, 0], B: [100, 0], C: [200, 50], D: [300, 50] }),
      [rel],
    );
    expect(results[0]!.relation).toBe(rel);
  });
});
