import { describe, expect, it } from 'vitest';
import {
  encodeBmp,
  extractLabels,
  recognizeLabels,
  type OcrPage,
  type OcrSymbolLike,
  type OcrWordLike,
} from './ocr';
import type { RawImage } from './lines';

/** 2×2 RGBA: пиксель (0,0) чёрный, остальные белые. */
function tinyImage(): RawImage {
  const data = new Uint8ClampedArray([
    0, 0, 0, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255,
  ]);
  return { width: 2, height: 2, data };
}

function readU16(b: Uint8Array, off: number): number {
  return b[off]! | (b[off + 1]! << 8);
}
function readU32(b: Uint8Array, off: number): number {
  return (readU16(b, off) | (b[off + 2]! << 16) | (b[off + 3]! << 24)) >>> 0;
}
function readI32(b: Uint8Array, off: number): number {
  return readU32(b, off) | 0;
}

describe('encodeBmp', () => {
  it('пишет корректный 24-битный BMP-заголовок', () => {
    const bmp = encodeBmp(tinyImage());
    expect(bmp[0]).toBe(0x42); // 'B'
    expect(bmp[1]).toBe(0x4d); // 'M'
    expect(readU32(bmp, 10)).toBe(54); // offset пиксельных данных (14+40)
    expect(readU32(bmp, 14)).toBe(40); // размер DIB-заголовка
    expect(readI32(bmp, 18)).toBe(2);
    expect(readI32(bmp, 22)).toBe(2);
    expect(readU16(bmp, 26)).toBe(1); // planes
    expect(readU16(bmp, 28)).toBe(24); // bpp
    expect(readU32(bmp, 30)).toBe(0); // compression
    expect(readU32(bmp, 2)).toBe(bmp.length); // заявленный размер = фактический
  });

  it('кодирует пиксели как BGR снизу вверх', () => {
    const bmp = encodeBmp(tinyImage());
    const rowStart = 54;
    expect([bmp[rowStart], bmp[rowStart + 1], bmp[rowStart + 2]]).toEqual([255, 255, 255]);
    // rowSize при ширине 2: 2*3=6 → пад до 8; верхняя строка (с чёрным пикселем) — вторая
    const topRow = 54 + 8;
    expect([bmp[topRow], bmp[topRow + 1], bmp[topRow + 2]]).toEqual([0, 0, 0]);
  });

  it('паддирует строки до кратности 4 байтам (ширина 3)', () => {
    const white = { width: 3, height: 1, data: new Uint8ClampedArray(3 * 1 * 4).fill(255) };
    const bmp = encodeBmp(white);
    expect(bmp.length).toBe(66); // 54 + 12 (3*3=9 → пад до 12)
    expect(readU32(bmp, 2)).toBe(66);
    expect(readU32(bmp, 34)).toBe(12); // biSizeImage
  });
});

/** Узел-символ в духе GetJSONText(). */
function sym(text: string, confidence: number, x0: number, y0: number, x1: number, y1: number) {
  return { text, confidence, bbox: { x0, y0, x1, y1 } };
}
/** Word-узел: поля уровня слова копируются с первого символа. */
function wordOf(...symbols: OcrSymbolLike[]): OcrWordLike {
  const first = symbols[0]!;
  return { ...first, symbols };
}
function pageOf(words: OcrWordLike[]): OcrPage {
  return { blocks: [{ paragraphs: [{ lines: [{ words }] }] }] };
}

describe('extractLabels', () => {
  it('берёт центр bbox и приводит к UPPERCASE', () => {
    const labels = extractLabels(pageOf([wordOf(sym('a', 90, 10, 20, 30, 40))]));
    expect(labels).toEqual([{ char: 'A', cx: 20, cy: 30 }]);
  });

  it('отбрасывает не-буквы, цифры и многосимвольные узлы', () => {
    const labels = extractLabels(
      pageOf([
        wordOf(
          sym('8', 95, 0, 0, 10, 10),
          sym('→', 90, 0, 0, 10, 10),
          sym('AB', 90, 0, 0, 10, 10),
          sym('c', 80, 4, 6, 12, 14),
        ),
      ]),
    );
    expect(labels).toEqual([{ char: 'C', cx: 8, cy: 10 }]);
  });

  it('отбрасывает символы ниже порога уверенности', () => {
    const labels = extractLabels(
      pageOf([wordOf(sym('X', 59, 0, 0, 10, 10), sym('Y', 60, 0, 0, 10, 10))]),
    );
    expect(labels).toEqual([{ char: 'Y', cx: 5, cy: 5 }]);
  });

  it('fallback на word-уровень, когда symbols пуст (LSTM-only core)', () => {
    const labels = extractLabels(
      pageOf([{ text: 'K', confidence: 88, bbox: { x0: 0, y0: 0, x1: 10, y1: 20 }, symbols: [] }]),
    );
    expect(labels).toEqual([{ char: 'K', cx: 5, cy: 10 }]);
  });

  it('возвращает [] для null blocks и сортирует по cy, затем cx', () => {
    expect(extractLabels({ blocks: null })).toEqual([]);
    const labels = extractLabels(
      pageOf([
        wordOf(sym('B', 90, 0, 20, 10, 30), sym('A', 90, 0, 0, 10, 10)),
        wordOf(sym('C', 90, 40, 0, 50, 10)),
      ]),
    );
    expect(labels.map((l) => l.char)).toEqual(['A', 'C', 'B']);
  });
});

const FONT_5X7: Record<string, string[]> = {
  E: ['#####', '#....', '#....', '####.', '#....', '#....', '#####'],
  H: ['#...#', '#...#', '#...#', '#####', '#...#', '#...#', '#...#'],
  L: ['#....', '#....', '#....', '#....', '#....', '#....', '#####'],
};

/** Белый холст 640×200; буквы A, B, M с шагом 200 px, глиф 80×112 (шрифт 5×7 × 16). */
function drawingWithLetters(): RawImage {
  const width = 640;
  const height = 200;
  const data = new Uint8ClampedArray(width * height * 4).fill(255);
  const setBlack = (x: number, y: number): void => {
    const i = (y * width + x) * 4;
    data[i] = 0;
    data[i + 1] = 0;
    data[i + 2] = 0;
  };
  ['E', 'H', 'L'].forEach((ch, index) => {
    const originX = 40 + index * 200;
    const originY = 44; // (200 − 112) / 2
    FONT_5X7[ch]!.forEach((row, ry) => {
      [...row].forEach((cell, rx) => {
        if (cell !== '#') return;
        for (let dy = 0; dy < 16; dy++) {
          for (let dx = 0; dx < 16; dx++) setBlack(originX + rx * 16 + dx, originY + ry * 16 + dy);
        }
      });
    });
  });
  return { width, height, data };
}

describe('recognizeLabels (интеграция, WASM)', () => {
  it('распознаёт E, H, L на синтетическом чертеже', async () => {
    const labels = await recognizeLabels(drawingWithLetters());
    expect(labels.map((l) => l.char).sort()).toEqual(['E', 'H', 'L']);
    const byChar = Object.fromEntries(labels.map((l) => [l.char, l]));
    expect(Math.abs(byChar['E']!.cx - 80)).toBeLessThanOrEqual(16);
    expect(Math.abs(byChar['E']!.cy - 100)).toBeLessThanOrEqual(16);
    expect(Math.abs(byChar['H']!.cx - 280)).toBeLessThanOrEqual(16);
    expect(Math.abs(byChar['L']!.cx - 480)).toBeLessThanOrEqual(16);
  });
});
