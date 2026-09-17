import { describe, expect, it } from 'vitest';
import {
  cropUpscale,
  inkCentroid,
  maskSegments,
  refineTargets,
  refineUnboundLabels,
} from './ocr-refine';
import type { RawImage } from './lines';
import type { LineSegment, Vertex } from './types';

const WHITE = [255, 255, 255, 255];

function solid(w: number, h: number): RawImage {
  return { width: w, height: h, data: new Uint8ClampedArray(w * h * 4).fill(255) };
}
function px(img: RawImage, x: number, y: number): number[] {
  const o = (y * img.width + x) * 4;
  return [img.data[o]!, img.data[o + 1]!, img.data[o + 2]!, img.data[o + 3]!];
}
function setPx(img: RawImage, x: number, y: number): void {
  const o = (y * img.width + x) * 4;
  img.data[o] = 0;
  img.data[o + 1] = 0;
  img.data[o + 2] = 0;
  img.data[o + 3] = 255;
}

describe('maskSegments (стирание отрезков из растра)', () => {
  it('стирает пиксели отрезка в полосе width, остальное не трогает', () => {
    const img = solid(10, 10);
    for (let x = 1; x < 9; x++) setPx(img, x, 5);
    setPx(img, 2, 2); // точка вне отрезка — должна остаться
    const out = maskSegments(img, [{ id: 's', x1: 1, y1: 5, x2: 8, y2: 5 }], 3);
    expect(px(out, 4, 5)).toEqual(WHITE); // центр отрезка стёрт
    expect(px(out, 1, 5)).toEqual(WHITE);
    expect(px(out, 4, 7)).toEqual(WHITE); // вне полосы не тронут (и так белый)
    expect(px(out, 2, 2)).toEqual([0, 0, 0, 255]); // точка сохранена
    expect(px(out, 0, 0)).toEqual(WHITE);
  });

  it('не мутирует вход', () => {
    const img = solid(6, 6);
    setPx(img, 0, 3);
    setPx(img, 5, 3);
    maskSegments(img, [{ id: 's', x1: 0, y1: 3, x2: 5, y2: 3 }], 3);
    expect(px(img, 0, 3)).toEqual([0, 0, 0, 255]); // вход без изменений
    expect(px(img, 5, 3)).toEqual([0, 0, 0, 255]);
  });
});

describe('cropUpscale (кроп вокруг точки + nearest-апскейл)', () => {
  it('копирует окно 2·radius с увеличением factor', () => {
    const img = solid(4, 4);
    setPx(img, 1, 1);
    const out = cropUpscale(img, 1, 1, 1, 2);
    expect(out.width).toBe(4);
    expect(out.height).toBe(4);
    // пиксель (1,1) источника → блок 2×2 в правом нижнем квадранте окна
    expect(px(out, 2, 2)).toEqual([0, 0, 0, 255]);
    expect(px(out, 3, 3)).toEqual([0, 0, 0, 255]);
    expect(px(out, 0, 0)).toEqual(WHITE); // источник (0,0) — белый
  });

  it('выход за границы изображения даёт белые пиксели', () => {
    const img = solid(3, 3);
    setPx(img, 0, 0);
    const out = cropUpscale(img, 0, 0, 2, 1); // окно [-2..1]²
    expect(out.width).toBe(4);
    expect(px(out, 2, 2)).toEqual([0, 0, 0, 255]); // (0,0) источника
    expect(px(out, 0, 0)).toEqual(WHITE); // (-2,-2) — белый
    expect(px(out, 3, 3)).toEqual(WHITE); // (1,1) источника — белый
  });
});

describe('refineTargets (вершины-кандидаты на refine-OCR)', () => {
  const v = (x: number, y: number, labels: string[]): Vertex => ({ x, y, labels });
  it('берёт вершины без меток в стороне от помеченных; пропускает рядом с помеченными', () => {
    const vertices = [v(0, 0, []), v(50, 0, ['A']), v(100, 0, []), v(130, 0, [])];
    const graph = { A: vertices[1]! };
    const targets = refineTargets(vertices, graph, 80);
    // (0,0): далеко от A(50,0)? d=50 ≤ 80 → пропущен! (100,0): d=50 → пропущен,
    // (130,0): d=30 ≤ 80 → пропущен. Все рядом с A — пусто.
    expect(targets).toEqual([]);
  });

  it('включает вершину дальше skipRadius от всех помеченных', () => {
    const vertices = [v(0, 0, ['A']), v(200, 0, [])];
    const graph = { A: vertices[0]! };
    expect(refineTargets(vertices, graph, 80)).toEqual([vertices[1]!]);
  });

  it('помеченные вершины никогда не попадают в цель', () => {
    const vertices = [v(0, 0, ['B'])];
    const graph = { B: vertices[0]! };
    expect(refineTargets(vertices, graph, 80)).toEqual([]);
  });
});

describe('refineUnboundLabels (оркестрация: маска → центроид → PSM 10)', () => {
  it('для каждой цели ищет глиф по центроиду, читает букву и ставит метку в координатах вершины', async () => {
    const img = solid(50, 50);
    setPx(img, 10, 15); // «глиф» у первой цели
    setPx(img, 40, 15); // «глиф» у второй цели
    const segments: LineSegment[] = [{ id: 's', x1: 0, y1: 25, x2: 49, y2: 25 }];
    const targets = [
      { x: 10, y: 25 },
      { x: 40, y: 25 },
    ];
    const seen: Array<[number, number]> = [];
    const labels = await refineUnboundLabels(img, segments, targets, {
      recognizeChar: async (crop) => {
        seen.push([crop.width, crop.height]);
        // первый кроп читается как K (уверенно), второй — мусор
        return seen.length === 1
          ? [{ char: 'K', cx: 0, cy: 0, confidence: 96 }]
          : [{ char: 'k', cx: 0, cy: 0, confidence: 30 }];
      },
    });
    expect(labels).toEqual([{ char: 'K', cx: 10, cy: 25 }]);
    // кропы чтения: width/height = 2·radius·upscale; радиусы [14, 18] × 6
    expect(seen).toContainEqual([14 * 2 * 6, 14 * 2 * 6]);
    // первая цель нашлась на младшем радиусе, вторая проверила оба
    expect(seen.length).toBe(3);
  });

  it('нет целей → OCR не вызывается, пусто', async () => {
    const labels = await refineUnboundLabels(solid(10, 10), [], [], {
      recognizeChar: async () => {
        throw new Error('не должен вызываться');
      },
    });
    expect(labels).toEqual([]);
  });

  it('нет чернил в окне локализации → цель пропускается без OCR', async () => {
    const labels = await refineUnboundLabels(
      solid(50, 50),
      [{ id: 's', x1: 0, y1: 25, x2: 49, y2: 25 }],
      [{ x: 25, y: 25 }],
      {
        recognizeChar: async () => {
          throw new Error('не должен вызываться');
        },
      },
    );
    expect(labels).toEqual([]);
  });
});

describe('inkCentroid (центроид чернил)', () => {
  it('считает центр тёмных пикселей; белое изображение → null', () => {
    const img = solid(10, 10);
    expect(inkCentroid(img, 128)).toBeNull();
    setPx(img, 2, 4);
    setPx(img, 4, 6);
    const c = inkCentroid(img, 128);
    expect(c).not.toBeNull();
    expect(c!.x).toBe(3);
    expect(c!.y).toBe(5);
  });
});
