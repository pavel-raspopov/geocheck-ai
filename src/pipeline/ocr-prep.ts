/** Подготовка изображения к OCR: белые поля + nearest-апскейл (чистые функции). */
import type { RawImage } from './lines';
import type { Point } from './types';

/**
 * Увеличивает растр в `factor` раз методом ближайшего соседа (crisp-пиксели:
 * сглаживание ломает сегментацию tesseract на мелких глифах — проверено на
 * testdata) и добавляет белые поля `pad` px (метки у края кадра теряются
 * без полей). Вход не мутирует.
 */
export function padAndUpscale(image: RawImage, pad: number, factor: number): RawImage {
  const width = image.width * factor + pad * 2;
  const height = image.height * factor + pad * 2;
  const data = new Uint8ClampedArray(width * height * 4).fill(255);
  for (let y = 0; y < image.height; y++) {
    const dstRow = (y * factor + pad) * width;
    for (let x = 0; x < image.width; x++) {
      const src = (y * image.width + x) * 4;
      for (let fy = 0; fy < factor; fy++) {
        const row = dstRow + fy * width;
        for (let fx = 0; fx < factor; fx++) {
          const dst = (row + x * factor + fx + pad) * 4;
          data[dst] = image.data[src]!;
          data[dst + 1] = image.data[src + 1]!;
          data[dst + 2] = image.data[src + 2]!;
          data[dst + 3] = image.data[src + 3]!;
        }
      }
    }
  }
  return { width, height, data };
}

/** Обратное преобразование точки подготовленного растра в координаты оригинала. */
export function toOriginPoint(cx: number, cy: number, pad: number, factor: number): Point {
  return { x: (cx - pad) / factor, y: (cy - pad) / factor };
}
