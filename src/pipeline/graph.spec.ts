import { describe, expect, it } from 'vitest';
import { buildGraph } from './graph';
import {
  INTERSECTION_CORNER_TOLERANCE,
  LABEL_RADIUS,
  ON_SEGMENT_TOLERANCE,
  VERTEX_MERGE_RADIUS,
} from './constants';
import { verify } from './verify';
import type { Label, LineSegment } from './types';

let nextId = 0;
function seg(x1: number, y1: number, x2: number, y2: number): LineSegment {
  return { id: `in-${nextId++}`, x1, y1, x2, y2 };
}
function label(char: string, cx: number, cy: number): Label {
  return { char, cx, cy };
}
/** Вершина с координатами (x, y) есть среди result.vertices (в пределах 1e-6). */
function hasVertex(vertices: { x: number; y: number }[], x: number, y: number): boolean {
  return vertices.some((v) => Math.abs(v.x - x) < 1e-6 && Math.abs(v.y - y) < 1e-6);
}

describe('buildGraph: вершины', () => {
  it('треугольник из 3 отрезков → 3 вершины в углах, порядок cy↑/cx↑', () => {
    const result = buildGraph(
      [seg(100, 200, 100, 100), seg(100, 100, 200, 100), seg(100, 200, 200, 100)],
      [],
    );
    expect(result.vertices).toHaveLength(3);
    expect(result.vertices[0]).toMatchObject({ x: 100, y: 100 });
    expect(result.vertices[1]).toMatchObject({ x: 200, y: 100 });
    expect(result.vertices[2]).toMatchObject({ x: 100, y: 200 });
  });

  it('концы отрезка — вершины (утверждённая интерпретация: endpoints считаются)', () => {
    const result = buildGraph([seg(100, 100, 200, 100)], []);
    expect(result.vertices).toHaveLength(2);
    expect(hasVertex(result.vertices, 100, 100)).toBe(true);
    expect(hasVertex(result.vertices, 200, 100)).toBe(true);
  });

  it('T-примыкание → одна вершина в точке касания, без дублей', () => {
    const result = buildGraph([seg(100, 100, 200, 100), seg(150, 100, 150, 50)], []);
    // Кандидаты: концы (150,100) ×2 + пересечение (150,100) → сливаются в одну.
    const near = result.vertices.filter(
      (v) => Math.hypot(v.x - 150, v.y - 100) <= VERTEX_MERGE_RADIUS,
    );
    expect(near).toHaveLength(1);
    expect(result.vertices).toHaveLength(4); // (100,100), (150,50), (150,100), (200,100)
  });

  it(`недолёт конца ≤ ${ON_SEGMENT_TOLERANCE} px → пересечение засчитано`, () => {
    const result = buildGraph([seg(100, 100, 200, 100), seg(150, 102, 150, 150)], []);
    expect(hasVertex(result.vertices, 150, 101)).toBe(true); // центроид (150,100)+(150,102)
  });

  it(`недолёт конца 4 px ≤ ${INTERSECTION_CORNER_TOLERANCE} px → угол по поддерживающим прямым`, () => {
    const result = buildGraph([seg(100, 100, 200, 100), seg(150, 104, 150, 150)], []);
    // пересечение поддерживающих прямых (150,100) + конец (150,104) → центроид
    expect(hasVertex(result.vertices, 150, 102)).toBe(true);
  });

  it(`недолёт конца 30 px (> ${INTERSECTION_CORNER_TOLERANCE}) → пересечение не засчитано`, () => {
    const result = buildGraph([seg(100, 100, 200, 100), seg(150, 130, 150, 150)], []);
    const near = result.vertices.filter((v) => Math.hypot(v.x - 150, v.y - 100) < 3);
    expect(near).toHaveLength(0);
  });

  it('два одинаковых отрезка → совпадающие концы сливаются (2 вершины, не 4)', () => {
    const result = buildGraph([seg(100, 100, 200, 100), seg(100, 100, 200, 100)], []);
    expect(result.vertices).toHaveLength(2);
  });

  it('параллельные отрезки не дают пересечения — только вершины-концы', () => {
    const result = buildGraph([seg(100, 100, 200, 100), seg(100, 200, 200, 200)], []);
    expect(result.vertices).toHaveLength(4);
  });
});

describe('buildGraph: привязка меток', () => {
  it(`метка на ${LABEL_RADIUS - 1} px → привязана; ${LABEL_RADIUS + 1} px → unboundLabels`, () => {
    const result = buildGraph(
      [seg(100, 100, 200, 100)],
      [label('A', 100, 100 - (LABEL_RADIUS - 1)), label('B', 200, 100 - (LABEL_RADIUS + 1))],
    );
    expect(result.graph.A).toMatchObject({ x: 100, y: 100 });
    expect(result.graph.B).toBeUndefined();
    expect(result.unboundLabels).toHaveLength(1);
    expect(result.unboundLabels[0]).toMatchObject({ char: 'B', cx: 200 });
  });

  it('метка привязывается к ближайшей из нескольких вершин', () => {
    const result = buildGraph(
      [seg(100, 100, 120, 100), seg(170, 100, 250, 100)],
      [label('K', 140, 100)],
    );
    expect(result.graph.K).toMatchObject({ x: 120, y: 100 });
  });

  it('дубликат буквы: выигрывает привязка к ближайшей вершине', () => {
    const result = buildGraph(
      [seg(100, 100, 200, 100), seg(300, 100, 400, 100)],
      [label('D', 105, 100), label('D', 398, 99)],
    );
    expect(result.graph.D).toMatchObject({ x: 400, y: 100 });
    expect(result.vertices[0]!.labels).toHaveLength(0);
    expect(result.vertices.find((v) => v.x === 400)!.labels).toEqual(['D']);
  });

  it('без вершин → все метки unbound, graph пуст', () => {
    const result = buildGraph([], [label('A', 50, 50)]);
    expect(result.graph).toEqual({});
    expect(result.vertices).toEqual([]);
    expect(result.unboundLabels).toEqual([label('A', 50, 50)]);
  });

  it('пустой вход → пустой выход', () => {
    expect(buildGraph([], [])).toEqual({ graph: {}, vertices: [], unboundLabels: [] });
  });

  it('детерминизм: два прогона глубоко равны; labels вершин отсортированы', () => {
    const segments = [seg(100, 200, 100, 100), seg(100, 100, 200, 100), seg(100, 200, 200, 100)];
    const labels = [label('C', 205, 95), label('A', 95, 205), label('B', 95, 95)];
    const first = buildGraph(segments, labels);
    const second = buildGraph(segments, labels);
    expect(second).toEqual(first);
    for (const vertex of first.vertices) expect(vertex.labels).toEqual([...vertex.labels].sort());
  });
});

describe('buildGraph: интеграция с verify (сцены ТЗ §5)', () => {
  it('прямоугольный треугольник ABC → verify perpendicular Success', () => {
    const { graph } = buildGraph(
      [seg(100, 200, 100, 100), seg(100, 100, 200, 100), seg(100, 200, 200, 100)],
      [label('A', 95, 205), label('B', 95, 95), label('C', 205, 95)],
    );
    expect(Object.keys(graph).sort()).toEqual(['A', 'B', 'C']);
    expect(verify({ graph, rule: 'perpendicular' }).status).toBe('Success');
  });

  it('параллельные отрезки AB и CD → verify parallel Success', () => {
    const { graph } = buildGraph(
      [seg(100, 100, 200, 100), seg(100, 200, 200, 200)],
      [label('A', 96, 96), label('B', 204, 96), label('C', 96, 196), label('D', 204, 196)],
    );
    expect(Object.keys(graph).sort()).toEqual(['A', 'B', 'C', 'D']);
    expect(verify({ graph, rule: 'parallel' }).status).toBe('Success');
  });

  it('M на AB через засечку → verify point-on-segment Success', () => {
    const { graph } = buildGraph(
      [seg(50, 100, 250, 100), seg(150, 80, 150, 120)],
      [label('A', 45, 95), label('M', 150, 95), label('B', 255, 105)],
    );
    expect(graph.M).toMatchObject({ x: 150, y: 100 });
    expect(verify({ graph, rule: 'point-on-segment' }).status).toBe('Success');
  });
});
