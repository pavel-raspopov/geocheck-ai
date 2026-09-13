import type { RawImage } from '../pipeline/lines';

/**
 * Декодирует файл в RawImage (RGBA) через createImageBitmap + canvas.
 * DOM-адаптер: валидация типа файла уже сделана upload-zone; бросает Error,
 * если декодировать не удалось, — app.ts превращает его в Error-вердикт.
 */
export async function fileToRawImage(file: File): Promise<RawImage> {
  const bitmap = await createImageBitmap(file);
  const canvas = document.createElement('canvas');
  canvas.width = bitmap.width;
  canvas.height = bitmap.height;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) {
    bitmap.close();
    throw new Error('Не удалось создать контекст холста');
  }
  ctx.drawImage(bitmap, 0, 0);
  bitmap.close();
  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  return { width: imageData.width, height: imageData.height, data: imageData.data };
}
