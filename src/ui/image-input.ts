import type { RawImage } from '../pipeline/lines';
import { MAX_IMAGE_DIMENSION } from '../pipeline/constants';
import { scaledDimensions } from '../pipeline/scale';

/** Результат декода: RawImage для пайплайна + превью-URL того же размера (оверлей совпадает). */
export interface DecodedImage {
  readonly raw: RawImage;
  readonly previewUrl: string;
}

/**
 * Декодирует файл в RawImage (RGBA) через createImageBitmap + canvas, сжимая до
 * MAX_IMAGE_DIMENSION по длинной стороне (бюджет ≤ 3 s). Превью кодируется из
 * того же canvas → размеры превью и анализа всегда равны. Бросает Error, если
 * декодировать не удалось (app.ts показывает мягкую ошибку).
 */
export async function fileToRawImage(
  file: File,
  maxDimension = MAX_IMAGE_DIMENSION,
): Promise<DecodedImage> {
  const bitmap = await createImageBitmap(file);
  const target = scaledDimensions(bitmap.width, bitmap.height, maxDimension);
  const canvas = document.createElement('canvas');
  canvas.width = target.width;
  canvas.height = target.height;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) {
    bitmap.close();
    throw new Error('Не удалось создать контекст холста');
  }
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(bitmap, 0, 0, target.width, target.height);
  bitmap.close();
  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const blob = await new Promise<Blob>((resolve, reject) =>
    canvas.toBlob(
      (b) => (b ? resolve(b) : reject(new Error('Не удалось закодировать превью'))),
      'image/png',
    ),
  );
  return {
    raw: { width: imageData.width, height: imageData.height, data: imageData.data },
    previewUrl: URL.createObjectURL(blob),
  };
}
