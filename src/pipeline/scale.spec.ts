import { describe, expect, it } from 'vitest';
import { MAX_IMAGE_DIMENSION } from './constants';
import { downscaleRawImage, scaledDimensions } from './scale';
import type { RawImage } from './lines';

describe('scaledDimensions', () => {
  it('не увеличивает маленькое изображение', () => {
    expect(scaledDimensions(640, 300, MAX_IMAGE_DIMENSION)).toEqual({ width: 640, height: 300 });
  });

  it('альбомное большое → длинная сторона = max', () => {
    expect(scaledDimensions(4000, 3000, MAX_IMAGE_DIMENSION)).toEqual({
      width: 1600,
      height: 1200,
    });
  });

  it('портретное большое → длинная сторона = max', () => {
    expect(scaledDimensions(1000, 3000, MAX_IMAGE_DIMENSION)).toEqual({ width: 533, height: 1600 });
  });

  it('пропорции сохраняются', () => {
    const s = scaledDimensions(3210, 1230, MAX_IMAGE_DIMENSION);
    expect(Math.abs(s.width / s.height - 3210 / 1230)).toBeLessThan(0.01);
  });

  it('граничный случай: не опускается ниже 1 px', () => {
    expect(scaledDimensions(5000, 4, 2)).toEqual({ width: 2, height: 1 });
  });
});

describe('downscaleRawImage', () => {
  it('nearest-neighbour: 4×2 → 2×1, берёт левые-верхние источники', () => {
    const src: RawImage = {
      width: 4,
      height: 2,
      data: new Uint8ClampedArray([
        10, 20, 30, 255, 40, 50, 60, 255, 70, 80, 90, 255, 100, 110, 120, 255, 130, 140, 150, 255,
        160, 170, 180, 255, 190, 200, 210, 255, 220, 230, 240, 255,
      ]),
    };
    const out = downscaleRawImage(src, 2);
    expect(out.width).toBe(2);
    expect(out.height).toBe(1);
    expect(Array.from(out.data.slice(0, 8))).toEqual([10, 20, 30, 255, 70, 80, 90, 255]);
  });
});
