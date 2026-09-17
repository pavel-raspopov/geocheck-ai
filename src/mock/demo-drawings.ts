import type { Label, LineSegment, Vertex } from '../pipeline/types';

/**
 * Демо-чертежи для Фазы 1 — рукописный «результат пайплайна» (без CV/OCR),
 * на котором работает настоящий движок verify(). Идеальная сцена проходит все
 * 4 правила при ε = 3.0; сцена с отклонениями воспроизводит классический кейс
 * ТЗ §5: угол 84.12° (отклонение 5.88°) и точка M за точкой B.
 */

/** Отклонение от 90°, дающее эталонный угол 84.12° из ТЗ §5. */
export const TILT_DEG = 5.88;

/** Длина ноги треугольника/сторон в демо-сцене, px. */
const LEG_LEN = 220;

export interface DemoDrawing {
  /** Стабильный идентификатор сценария. */
  readonly id: string;
  /** Русское название сценария для UI. */
  readonly label: string;
  /** Граф «метка → вершина» — вход для verify(). */
  readonly graph: Record<string, Vertex>;
  /** Сегменты для отрисовки на холсте. */
  readonly segments: readonly LineSegment[];
  /** Метки букв для отрисовки на холсте. */
  readonly labels: readonly Label[];
}

function vertex(x: number, y: number, ...labels: string[]): Vertex {
  return { x, y, labels };
}

function segment(id: string, x1: number, y1: number, x2: number, y2: number): LineSegment {
  return { id, x1, y1, x2, y2 };
}

/** Идеальная сцена: вертикальный AB, горизонтальный BC, вертикальный CD, M — середина AB. */
export const IDEAL_DEMO: DemoDrawing = {
  id: 'ideal',
  label: 'Идеальный чертёж (все правила верны)',
  graph: {
    A: vertex(300, 100, 'A'),
    B: vertex(300, 320, 'B'),
    C: vertex(520, 320, 'C'),
    D: vertex(520, 100, 'D'),
    M: vertex(300, 210),
  },
  segments: [
    segment('ab', 300, 100, 300, 320),
    segment('bc', 300, 320, 520, 320),
    segment('cd', 520, 320, 520, 100),
  ],
  labels: [
    { char: 'A', cx: 300, cy: 100 },
    { char: 'B', cx: 300, cy: 320 },
    { char: 'C', cx: 520, cy: 320 },
    { char: 'D', cx: 520, cy: 100 },
    { char: 'M', cx: 300, cy: 210 },
  ],
};

/** Поворот BC вокруг B на −TILT_DEG: длина 220 сохраняется, ∠ABC становится 84.12°. */
const tiltRad = (-TILT_DEG * Math.PI) / 180;
const bx = 300;
const by = 320;
const cx = bx + LEG_LEN * Math.cos(tiltRad);
const cy = by + LEG_LEN * Math.sin(tiltRad);

/** Сцена с отклонениями: ∠ABC = 84.12° (5.88° от нормы), M — за точкой B. */
export const TILTED_DEMO: DemoDrawing = {
  id: 'tilted',
  label: 'Отклонения: ∠ABC = 84.12°, M за точкой B',
  graph: {
    A: vertex(300, 100, 'A'),
    B: vertex(bx, by, 'B'),
    C: vertex(cx, cy, 'C'),
    D: vertex(cx, cy - LEG_LEN, 'D'),
    M: vertex(300, 340),
  },
  segments: [
    segment('ab', 300, 100, 300, 320),
    segment('bc', bx, by, cx, cy),
    segment('cd', cx, cy, cx, cy - LEG_LEN),
  ],
  labels: [
    { char: 'A', cx: 300, cy: 100 },
    { char: 'B', cx: bx, cy: by },
    { char: 'C', cx: cx, cy: cy },
    { char: 'D', cx: cx, cy: cy - LEG_LEN },
    { char: 'M', cx: 300, cy: 340 },
  ],
};

/** Все демо-сценарии для выпадающего списка. */
export const DEMO_DRAWINGS: readonly DemoDrawing[] = [IDEAL_DEMO, TILTED_DEMO];

/**
 * Текст задачи, которому соответствуют обе демо-сцены: идеальная проходит все
 * 4 правила, наклонная даёт Fail по ∠ABC (= 84.12°) и M-за-B (кейс ТЗ §5).
 */
export const DEMO_TASK_TEXT = '∠ABC = 90°, AB ∥ CD, AB = CD, точка M лежит на отрезке AB';
