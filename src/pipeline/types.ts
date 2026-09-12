/** Доменные типы пайплайна GeoCheck AI. */

export interface Point {
  x: number;
  y: number;
}

export interface LineSegment {
  id: string;
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}

/** OCR-результат: одиночная латинская буква и координаты её центра. */
export interface Label {
  char: string;
  cx: number;
  cy: number;
}

export interface Vertex {
  x: number;
  y: number;
  labels: string[];
}

export type Rule = 'perpendicular' | 'parallel' | 'equal-segments' | 'point-on-segment';

export type VerifyStatus = 'Success' | 'Fail' | 'Error';

export interface VerifyInput {
  /** Метка (заглавная A–Z) → вершина. */
  graph: Record<string, Vertex>;
  rule: Rule;
  /** Погрешность ε, по умолчанию EPS_DEFAULT (3.0). */
  epsilon?: number;
}

export interface VerifyResult {
  status: VerifyStatus;
  /** Сообщение на русском; точные строки ТЗ — контракт. */
  message: string;
  /** Абсолютное измеренное отклонение, если вычислимо. */
  deviation?: number;
  epsilon: number;
}
