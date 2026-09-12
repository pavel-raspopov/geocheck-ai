import { describe, expect, it } from 'vitest';
import { detectSegments, type RawImage } from './lines';
import { MIN_SEGMENT_LENGTH } from './constants';

/** Пустое RGBA-изображение (белый фон) — структурный аналог ImageData, без DOM. */
function blankImage(width: number, height: number): RawImage {
  return {
    width,
    height,
    data: new Uint8ClampedArray(width * height * 4).fill(255),
  };
}

/** Чёрный отрезок толщиной 3 px (Брезенхэм + 2 смещения по нормали). */
function drawLine(image: RawImage, x1: number, y1: number, x2: number, y2: number): void {
  const { width: w, height: h, data } = image;
  const dx = x2 - x1;
  const dy = y2 - y1;
  const len = Math.hypot(dx, dy) || 1;
  const nx = -dy / len;
  const ny = dx / len;
  for (let t = -1; t <= 1; t++) {
    const ox = Math.round(nx * t);
    const oy = Math.round(ny * t);
    const steps = Math.ceil(Math.max(Math.abs(dx), Math.abs(dy))) + 1;
    for (let s = 0; s < steps; s++) {
      const x = Math.round(x1 + (dx * s) / (steps - 1)) + ox;
      const y = Math.round(y1 + (dy * s) / (steps - 1)) + oy;
      if (x < 0 || y < 0 || x >= w || y >= h) continue;
      const i = (y * w + x) * 4;
      data[i] = 0;
      data[i + 1] = 0;
      data[i + 2] = 0;
      data[i + 3] = 255;
    }
  }
}

function length(x1: number, y1: number, x2: number, y2: number): number {
  return Math.hypot(x2 - x1, y2 - y1);
}

/** Найдётся ли среди найденных сегментов совпадающий с ожидаемым (с допуском). */
function hasNear(
  segments: { x1: number; y1: number; x2: number; y2: number }[],
  ex1: number,
  ey1: number,
  ex2: number,
  ey2: number,
  tol: number,
): boolean {
  return segments.some((s) => {
    const direct =
      Math.abs(s.x1 - ex1) <= tol &&
      Math.abs(s.y1 - ey1) <= tol &&
      Math.abs(s.x2 - ex2) <= tol &&
      Math.abs(s.y2 - ey2) <= tol;
    const flipped =
      Math.abs(s.x1 - ex2) <= tol &&
      Math.abs(s.y1 - ey2) <= tol &&
      Math.abs(s.x2 - ex1) <= tol &&
      Math.abs(s.y2 - ey1) <= tol;
    return direct || flipped;
  });
}

describe('detectSegments (OpenCV.js HoughLinesP)', () => {
  it('находит длинный горизонтальный отрезок', async () => {
    const image = blankImage(200, 200);
    drawLine(image, 20, 100, 180, 100); // 160 px
    const segments = await detectSegments(image);
    expect(segments.length).toBeGreaterThan(0);
    expect(hasNear(segments, 20, 100, 180, 100, 4)).toBe(true);
  }, 120_000);

  it('находит вертикальный и горизонтальный отрезки в одном изображении', async () => {
    const image = blankImage(200, 200);
    drawLine(image, 40, 20, 40, 180); // вертикаль, 160 px
    drawLine(image, 20, 60, 180, 60); // горизонталь, 160 px
    const segments = await detectSegments(image);
    expect(hasNear(segments, 40, 20, 40, 180, 4)).toBe(true);
    expect(hasNear(segments, 20, 60, 180, 60, 4)).toBe(true);
  }, 120_000);

  it('находит диагональный отрезок', async () => {
    const image = blankImage(200, 200);
    drawLine(image, 20, 20, 160, 160);
    const segments = await detectSegments(image);
    expect(hasNear(segments, 20, 20, 160, 160, 5)).toBe(true);
  }, 120_000);

  it('прямоугольник: все 4 стороны, каждая ≥ MIN_SEGMENT_LENGTH, id уникальны', async () => {
    const image = blankImage(200, 160);
    drawLine(image, 20, 20, 140, 20);
    drawLine(image, 140, 20, 140, 140);
    drawLine(image, 140, 140, 20, 140);
    drawLine(image, 20, 140, 20, 20);
    const segments = await detectSegments(image);
    expect(hasNear(segments, 20, 20, 140, 20, 4)).toBe(true);
    expect(hasNear(segments, 140, 20, 140, 140, 4)).toBe(true);
    expect(hasNear(segments, 140, 140, 20, 140, 4)).toBe(true);
    expect(hasNear(segments, 20, 140, 20, 20, 4)).toBe(true);
    for (const s of segments) {
      expect(length(s.x1, s.y1, s.x2, s.y2)).toBeGreaterThanOrEqual(MIN_SEGMENT_LENGTH);
    }
    expect(new Set(segments.map((s) => s.id)).size).toBe(segments.length);
  }, 120_000);

  it('отфильтровывает короткий отрезок (< 30 px)', async () => {
    const image = blankImage(200, 200);
    drawLine(image, 50, 100, 64, 100); // 15 px
    const segments = await detectSegments(image);
    expect(segments).toHaveLength(0);
  }, 120_000);

  it('пустое изображение → пустой массив без ошибок', async () => {
    const segments = await detectSegments(blankImage(120, 120));
    expect(segments).toEqual([]);
  });
});
