import { describe, expect, it } from 'vitest';
import { analyzeDrawing, type PipelineDeps } from './run';
import { TILTED_DEMO } from '../mock/demo-drawings';
import { detectSegments } from './lines';
import { deduplicateSegments } from './dedup';
import { recognizeLabels } from './ocr';
import { buildGraph } from './graph';
import { verify } from './verify';
import type { RawImage } from './lines';
import type { Label, LineSegment } from './types';

/** Любой растр: стадии подменены через DI, пиксели не используются. */
const BLANK: RawImage = { width: 2, height: 2, data: new Uint8ClampedArray(16).fill(255) };

function seg(id: string, x1: number, y1: number, x2: number, y2: number): LineSegment {
  return { id, x1, y1, x2, y2 };
}
function label(char: string, cx: number, cy: number): Label {
  return { char, cx, cy };
}
function stubDeps(segments: LineSegment[], labels: Label[]): PipelineDeps {
  return { detectSegments: async () => segments, recognizeLabels: async () => labels };
}

/** Прямой угол при B: AB вертикаль, BC горизонталь (паттерн demo-drawings). */
const IDEAL: LineSegment[] = [
  seg('ab', 300, 100, 300, 320),
  seg('bc', 300, 320, 520, 320),
  seg('cd', 520, 320, 520, 100),
];
const IDEAL_LABELS: Label[] = [label('A', 284, 92), label('B', 284, 328), label('C', 536, 328)];

describe('analyzeDrawing (DI, детерминированно)', () => {
  it('проводит стадии: идеальный прямой угол → Success с точным текстом', async () => {
    const result = await analyzeDrawing(BLANK, 'perpendicular', 3, stubDeps(IDEAL, IDEAL_LABELS));
    expect(result.segments.map((s) => s.id)).toEqual(['seg-0', 'seg-1', 'seg-2']);
    expect(result.graph.A).toBeDefined();
    expect(result.graph.B).toBeDefined();
    expect(result.graph.C).toBeDefined();
    expect(result.verdict.status).toBe('Success');
    expect(result.verdict.message).toBe('Верно: угол ABC = 90.00° (в пределах ε = 3.00)');
    expect(result.verdict.epsilon).toBe(3);
    expect(result.unboundLabels).toEqual([]);
  });

  it('пустая детекция → мягкая ошибка «отрезков не найдено», оверлей пуст', async () => {
    const result = await analyzeDrawing(BLANK, 'perpendicular', 3, stubDeps([], []));
    expect(result.segments).toEqual([]);
    expect(result.vertices).toEqual([]);
    expect(result.graph).toEqual({});
    expect(result.verdict.status).toBe('Error');
    expect(result.verdict.message).toBe('[Status: Error] На чертеже не найдено отрезков');
  });

  it('замеряет длительности стадий (DI)', async () => {
    const delay = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms));
    const result = await analyzeDrawing(BLANK, 'perpendicular', 3, {
      detectSegments: async () => {
        await delay(5);
        return IDEAL;
      },
      recognizeLabels: async () => {
        await delay(5);
        return IDEAL_LABELS;
      },
    });
    expect(result.timings.detect).toBeGreaterThanOrEqual(4);
    expect(result.timings.recognize).toBeGreaterThanOrEqual(4);
    expect(result.timings.graph).toBeGreaterThanOrEqual(0);
    expect(result.timings.verify).toBeGreaterThanOrEqual(0);
    expect(result.timings.total).toBeGreaterThanOrEqual(
      result.timings.detect + result.timings.recognize,
    );
  });

  it('пустая детекция: timings присутствуют (recognize = 0)', async () => {
    const result = await analyzeDrawing(BLANK, 'perpendicular', 3, {
      detectSegments: async () => [],
    });
    expect(result.timings.recognize).toBe(0);
    expect(result.timings.total).toBeGreaterThanOrEqual(result.timings.detect);
  });

  it('метки не распознались → мягкая ошибка ТЗ про точку A', async () => {
    const result = await analyzeDrawing(BLANK, 'perpendicular', 3, stubDeps(IDEAL, []));
    expect(result.verdict.status).toBe('Error');
    expect(result.verdict.message).toBe('[Status: Error] Точка A не найдена на чертеже');
  });

  it('метка без вершины в радиусе 40 px попадает в unboundLabels', async () => {
    const labels = [...IDEAL_LABELS, label('Z', 100, 550)];
    const result = await analyzeDrawing(BLANK, 'perpendicular', 3, stubDeps(IDEAL, labels));
    expect(result.unboundLabels).toEqual([label('Z', 100, 550)]);
    expect(result.graph.Z).toBeUndefined();
    expect(result.verdict.status).toBe('Success');
  });

  it('дедупликация выполняется внутри проводки (дубль AB сливается)', async () => {
    const dup: LineSegment[] = [
      seg('ab1', 300, 100, 300, 320),
      seg('ab2', 303, 100, 303, 320),
      seg('bc', 300, 320, 520, 320),
    ];
    const result = await analyzeDrawing(BLANK, 'perpendicular', 3, stubDeps(dup, IDEAL_LABELS));
    expect(result.segments).toHaveLength(2);
  });
});

/** ТЗ §5, кейс 2: ∠ABC = 84.12° при ε = 3 → Fail с точным текстом (DI). */
describe('analyzeDrawing — acceptance ТЗ §5 (DI)', () => {
  it('84.12° при ε = 3 → Fail: «Ошибка: Угол ABC на рисунке равен 84.12°…»', async () => {
    const result = await analyzeDrawing(BLANK, 'perpendicular', 3, {
      detectSegments: async () => [...TILTED_DEMO.segments],
      recognizeLabels: async () => [...TILTED_DEMO.labels],
    });
    expect(result.verdict.status).toBe('Fail');
    expect(result.verdict.message).toBe(
      'Ошибка: Угол ABC на рисунке равен 84.12°, отклонение составляет 5.88°',
    );
  });

  it('M на отрезке AB (пересечение с тиком) → Success point-on-segment', async () => {
    const segments = [seg('ab', 300, 100, 300, 320), seg('tick', 285, 210, 315, 210)];
    const labels = [label('A', 284, 92), label('B', 278, 336), label('M', 300, 180)];
    const result = await analyzeDrawing(BLANK, 'point-on-segment', 3, stubDeps(segments, labels));
    expect(result.graph.M).toBeDefined();
    expect(result.verdict.status).toBe('Success');
    expect(result.verdict.message).toBe('Верно: точка M принадлежит отрезку AB');
  });

  it('M за точкой B (тик за пределами AB) → Fail со смещением', async () => {
    const segments = [seg('ab', 300, 100, 300, 320), seg('tick', 285, 340, 315, 340)];
    const labels = [label('A', 284, 92), label('B', 278, 308), label('M', 312, 352)];
    const result = await analyzeDrawing(BLANK, 'point-on-segment', 3, stubDeps(segments, labels));
    expect(result.verdict.status).toBe('Fail');
    expect(result.verdict.message.startsWith('Ошибка: Точка M не лежит на отрезке AB')).toBe(true);
  });

  it('метка M слишком далеко от любой вершины → мягкая ошибка ТЗ', async () => {
    const segments = [seg('ab', 300, 100, 300, 320)];
    const labels = [label('A', 284, 92), label('B', 278, 308), label('M', 100, 550)];
    const result = await analyzeDrawing(BLANK, 'point-on-segment', 3, stubDeps(segments, labels));
    expect(result.verdict.status).toBe('Error');
    expect(result.verdict.message).toBe('[Status: Error] Точка M не найдена на чертеже');
  });
});

const FONT_5X7: Record<string, string[]> = {
  C: ['01111', '10000', '10000', '10000', '10000', '10000', '01111'],
  E: ['#####', '#....', '#....', '####.', '#....', '#....', '#####'],
  H: ['#...#', '#...#', '#...#', '#####', '#...#', '#...#', '#...#'],
  L: ['#....', '#....', '#....', '#....', '#....', '#....', '#####'],
};

/** Белый холст + заливка пикселя (паттерн ocr.spec.ts). */
function makeCanvas(width: number, height: number) {
  const data = new Uint8ClampedArray(width * height * 4).fill(255);
  const setBlack = (x: number, y: number): void => {
    const i = (y * width + x) * 4;
    data[i] = 0;
    data[i + 1] = 0;
    data[i + 2] = 0;
  };
  return { data, setBlack };
}

/** Толстая линия: квадрат thickness×thickness вдоль отрезка с шагом 0.5 px. */
function drawThickLine(
  setBlack: (x: number, y: number) => void,
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  thickness = 3,
): void {
  const steps = Math.ceil(Math.hypot(x2 - x1, y2 - y1) * 2);
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const cx = Math.round(x1 + (x2 - x1) * t);
    const cy = Math.round(y1 + (y2 - y1) * t);
    for (let dy = -thickness; dy <= thickness; dy++) {
      for (let dx = -thickness; dx <= thickness; dx++) setBlack(cx + dx, cy + dy);
    }
  }
}

/** Глиф 5×7 × scale; origin — левый верхний угол глифа. */
function drawLetter(
  setBlack: (x: number, y: number) => void,
  ch: string,
  originX: number,
  originY: number,
  scale = 16,
): void {
  FONT_5X7[ch]!.forEach((row, ry) => {
    [...row].forEach((cell, rx) => {
      if (cell !== '#') return;
      for (let dy = 0; dy < scale; dy++) {
        for (let dx = 0; dx < scale; dx++) {
          setBlack(originX + rx * scale + dx, originY + ry * scale + dy);
        }
      }
    });
  });
}

/** Чертёж: верхняя сторона (104,120)–(504,120), две вертикали вниз, низ (104,520)–(504,520). */
function rectangleImage(): RawImage {
  const { data, setBlack } = makeCanvas(640, 600);
  drawThickLine(setBlack, 104, 120, 504, 120);
  drawThickLine(setBlack, 104, 120, 104, 520);
  drawThickLine(setBlack, 304, 120, 304, 520);
  drawThickLine(setBlack, 504, 120, 504, 520);
  drawThickLine(setBlack, 104, 520, 504, 520);
  return { width: 640, height: 600, data };
}

/** Метки E/H/L в ДОКАЗАННОЙ раскладке одной строкой (паттерн ocr.spec, распознаётся
 * стабильно: центры (80,100)/(280,100)/(480,100)). Центры в 31.2 px от верхних
 * углов (104/304/504, 120) ≤ LABEL_RADIUS 40. Блок-глифы A/B LSTM читает
 * ненадёжно (A→E, B→L); полный Success-path e2e — браузерный QA (реальный шрифт). */
function rectangleLabelsImage(): RawImage {
  const { data, setBlack } = makeCanvas(640, 600);
  drawLetter(setBlack, 'E', 40, 44); // центр (80,100) — у вершины (104,120)
  drawLetter(setBlack, 'H', 240, 44); // центр (280,100) — у вершины (304,120)
  drawLetter(setBlack, 'L', 440, 44); // центр (480,100) — у вершины (504,120)
  return { width: 640, height: 600, data };
}

describe('analyzeDrawing (e2e, WASM: OpenCV + tesseract)', () => {
  it('проводка: сегменты → OCR-метки → граф → софт-ошибка ТЗ (точка A не найдена)', async () => {
    // Реальные WASM-стадии на одном макете: сегменты — с растра линий,
    // метки — с растра букв (линии поверх букв ломают сегментацию tesseract).
    const segments = deduplicateSegments(await detectSegments(rectangleImage()));
    const labels = await recognizeLabels(rectangleLabelsImage());
    const { graph, vertices, unboundLabels } = buildGraph(segments, labels);
    const verdict = verify({ graph, rule: 'perpendicular', epsilon: 3 });
    expect(labels.map((l) => l.char).sort()).toEqual(['E', 'H', 'L']);
    expect(unboundLabels).toEqual([]);
    expect(Object.keys(graph).sort()).toEqual(['E', 'H', 'L']);
    expect(vertices.length).toBeGreaterThanOrEqual(4);
    // Привязка к тем вершинам, у которых стояли буквы (центроид кластера ± зазор).
    expect(Math.abs(graph['E']!.x - 104)).toBeLessThanOrEqual(6);
    expect(Math.abs(graph['E']!.y - 120)).toBeLessThanOrEqual(6);
    expect(Math.abs(graph['H']!.x - 304)).toBeLessThanOrEqual(6);
    expect(Math.abs(graph['H']!.y - 120)).toBeLessThanOrEqual(6);
    expect(Math.abs(graph['L']!.x - 504)).toBeLessThanOrEqual(6);
    expect(Math.abs(graph['L']!.y - 120)).toBeLessThanOrEqual(6);
    // Движок получает граф и возвращает контрактную мягкую ошибку ТЗ.
    expect(verdict.status).toBe('Error');
    expect(verdict.message).toBe('[Status: Error] Точка A не найдена на чертеже');
  }, 120000);
});
