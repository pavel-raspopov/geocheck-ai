import { describe, expect, it } from 'vitest';
import { verify } from './verify';
import type { VerifyInput, VerifyResult, Vertex } from './types';

/** Строит граф «метка → вершина» из координат [x, y] (экранные координаты, ось y вниз). */
function graph(map: Record<string, [number, number]>): Record<string, Vertex> {
  const out: Record<string, Vertex> = {};
  for (const [key, [x, y]] of Object.entries(map)) {
    out[key] = { x, y, labels: [key] };
  }
  return out;
}

function run(input: VerifyInput): VerifyResult {
  return verify(input);
}

describe('verify: перпендикулярность', () => {
  it('прямоугольный треугольник → Success (ТЗ §5)', () => {
    const result = run({
      rule: 'perpendicular',
      graph: graph({ A: [0, -50], B: [0, 0], C: [80, 0] }),
    });
    expect(result.status).toBe('Success');
    expect(result.deviation).toBeCloseTo(0, 6);
  });

  it('угол 84.12° при ε=3 → Fail с точным текстом ТЗ', () => {
    const rad = (84.12 * Math.PI) / 180;
    const result = run({
      rule: 'perpendicular',
      epsilon: 3.0,
      graph: graph({
        B: [0, 0],
        A: [100, 0],
        C: [100 * Math.cos(rad), 100 * Math.sin(rad)],
      }),
    });
    expect(result.status).toBe('Fail');
    expect(result.message).toBe(
      'Ошибка: Угол ABC на рисунке равен 84.12°, отклонение составляет 5.88°',
    );
  });

  it('использует ε=3.0 по умолчанию', () => {
    const rad = (87.5 * Math.PI) / 180;
    const result = run({
      rule: 'perpendicular',
      graph: graph({
        B: [0, 0],
        A: [100, 0],
        C: [100 * Math.cos(rad), 100 * Math.sin(rad)],
      }),
    });
    expect(result.status).toBe('Success');
    expect(result.epsilon).toBe(3.0);
  });
});

describe('verify: параллельность', () => {
  it('горизонтальные прямые → Success', () => {
    const result = run({
      rule: 'parallel',
      graph: graph({ A: [0, 0], B: [100, 0], C: [0, 40], D: [100, 40] }),
    });
    expect(result.status).toBe('Success');
  });

  it('непараллельные прямые → Fail с отклонением > ε', () => {
    const result = run({
      rule: 'parallel',
      epsilon: 3.0,
      graph: graph({ A: [0, 0], B: [100, 0], C: [0, 40], D: [90, 50] }),
    });
    expect(result.status).toBe('Fail');
    expect(result.message).toMatch(/^Ошибка: Прямые AB и CD не параллельны/);
    expect(result.deviation).toBeGreaterThan(3.0);
  });
});

describe('verify: равенство отрезков', () => {
  it('равные отрезки → Success', () => {
    const result = run({
      rule: 'equal-segments',
      graph: graph({ A: [0, 0], B: [100, 0], C: [200, 50], D: [300, 50] }),
    });
    expect(result.status).toBe('Success');
  });

  it('разная длина → Fail с текстом', () => {
    const result = run({
      rule: 'equal-segments',
      epsilon: 3.0,
      graph: graph({ A: [0, 0], B: [100, 0], C: [200, 50], D: [250, 50] }),
    });
    expect(result.status).toBe('Fail');
    expect(result.message).toBe(
      'Ошибка: Длина AB = 100.00 px, длина CD = 50.00 px, отклонение составляет 50.00 px',
    );
  });
});

describe('verify: принадлежность точки', () => {
  it('M между A и B → Success', () => {
    const result = run({
      rule: 'point-on-segment',
      graph: graph({ M: [40, 0], A: [0, 0], B: [100, 0] }),
    });
    expect(result.status).toBe('Success');
  });

  it('M за точкой B на той же прямой → Fail (ТЗ §5, граничный тест)', () => {
    const result = run({
      rule: 'point-on-segment',
      epsilon: 3.0,
      graph: graph({ M: [140, 0], A: [0, 0], B: [100, 0] }),
    });
    expect(result.status).toBe('Fail');
    expect(result.message).toBe('Ошибка: Точка M не лежит на отрезке AB (смещение 80.00 px)');
  });
});

describe('verify: мягкие ошибки (ТЗ §4)', () => {
  it('ненайденная буква → Error с точным текстом', () => {
    const result = run({
      rule: 'point-on-segment',
      graph: graph({ A: [0, 0], B: [100, 0] }),
    });
    expect(result.status).toBe('Error');
    expect(result.message).toBe('[Status: Error] Точка M не найдена на чертеже');
  });
});
