/** Решение о даунскейле: чистая функция, без DOM. Пороги ТЗ применяются в масштабе анализа. */
import type { RawImage } from './lines';

export interface ImageDimensions {
  readonly width: number;
  readonly height: number;
}

/** Целевые размеры: upscale запрещён; длинная сторона сжимается до maxDimension. */
export function scaledDimensions(
  width: number,
  height: number,
  maxDimension: number,
): ImageDimensions {
  const longest = Math.max(width, height);
  if (longest <= maxDimension || longest <= 0) {
    return { width, height };
  }
  const scale = maxDimension / longest;
  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale)),
  };
}

/** Даунскейл RawImage (nearest-neighbour) — для тестов и не-canvas-потребителей. */
export function downscaleRawImage(image: RawImage, maxDimension: number): RawImage {
  const target = scaledDimensions(image.width, image.height, maxDimension);
  if (target.width === image.width && target.height === image.height) {
    return image;
  }
  const data = new Uint8ClampedArray(target.width * target.height * 4);
  for (let y = 0; y < target.height; y++) {
    const sy = Math.min(image.height - 1, Math.floor((y * image.height) / target.height));
    for (let x = 0; x < target.width; x++) {
      const sx = Math.min(image.width - 1, Math.floor((x * image.width) / target.width));
      const src = (sy * image.width + sx) * 4;
      const dst = (y * target.width + x) * 4;
      data[dst] = image.data[src] ?? 0;
      data[dst + 1] = image.data[src + 1] ?? 0;
      data[dst + 2] = image.data[src + 2] ?? 0;
      data[dst + 3] = image.data[src + 3] ?? 0;
    }
  }
  return { width: target.width, height: target.height, data };
}
