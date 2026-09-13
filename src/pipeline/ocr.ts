/** Стадия 3 пайплайна (ТЗ §2): OCR одиночных латинских букв A–Z + центры (ТЗ §3.1). */
import {
  OCR_CHAR_WHITELIST,
  OCR_LANG,
  OCR_MIN_CONFIDENCE,
  OCR_PSM,
  OCR_USER_DPI,
} from './constants';
import type { RawImage } from './lines';
import type { Label } from './types';

/**
 * Кодирование RawImage (RGBA) в несжатый 24-битный BMP (байты, Uint8Array).
 * tesseract.js v7 не принимает «сырые» пиксели — только закодированные байты
 * изображения; BMP определяется по magic-байтам 'BM' и декодируется в воркере
 * через bmp-js. Строки снизу вверх, каналы BGR, паддинг строк до 4 байт.
 */
export function encodeBmp(image: RawImage): Uint8Array {
  const { width, height, data } = image;
  const rowSize = Math.ceil((width * 3) / 4) * 4;
  const pixelSize = rowSize * height;
  const bmp = new Uint8Array(54 + pixelSize);
  const view = new DataView(bmp.buffer);

  bmp[0] = 0x42; // 'B'
  bmp[1] = 0x4d; // 'M'
  view.setUint32(2, bmp.length, true);
  view.setUint32(10, 54, true);
  view.setUint32(14, 40, true);
  view.setInt32(18, width, true);
  view.setInt32(22, height, true); // положительная высота = снизу вверх
  view.setUint16(26, 1, true); // цветовые плоскости
  view.setUint16(28, 24, true); // бит на пиксель
  view.setUint32(30, 0, true); // без сжатия
  view.setUint32(34, pixelSize, true); // размер пиксельных данных
  view.setInt32(38, 2835, true); // разрешение, px/м (96 dpi)
  view.setInt32(42, 2835, true);

  for (let y = 0; y < height; y++) {
    const srcRow = (height - 1 - y) * width * 4; // переворот по вертикали
    const dstRow = 54 + y * rowSize;
    for (let x = 0; x < width; x++) {
      const s = srcRow + x * 4;
      const d = dstRow + x * 3;
      bmp[d] = data[s + 2]!; // B
      bmp[d + 1] = data[s + 1]!; // G
      bmp[d + 2] = data[s]!; // R
    }
  }
  return bmp;
}

/** Минимальная структурная модель JSON-дерева blocks (GetJSONText(), tesseract.js v7). */
export interface OcrBboxLike {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}
export interface OcrSymbolLike {
  text: string;
  confidence: number;
  bbox: OcrBboxLike;
}
export interface OcrWordLike extends OcrSymbolLike {
  symbols?: OcrSymbolLike[];
}
export interface OcrPage {
  blocks: { paragraphs: { lines: { words: OcrWordLike[] }[] }[] }[] | null;
}

const isUppercaseLatin = (text: string): boolean => text.length === 1 && text >= 'A' && text <= 'Z';

/** Проход по дереву: символы с приоритетом, fallback — весь word как одиночная буква. */
function* collectCandidates(page: OcrPage): Generator<OcrSymbolLike> {
  for (const block of page.blocks ?? []) {
    for (const paragraph of block.paragraphs) {
      for (const line of paragraph.lines) {
        for (const word of line.words) {
          const symbols = word.symbols ?? [];
          if (symbols.length > 0) {
            yield* symbols;
          } else {
            yield word;
          }
        }
      }
    }
  }
}

/**
 * Пост-фильтрация OCR (ТЗ §3.1): строго одиночные латинские буквы,
 * автоприведение к UPPERCASE (строчные → заглавные), центр = середина bbox.
 * LSTM-движок игнорирует tessedit_char_whitelist, поэтому фильтр здесь обязателен.
 */
export function extractLabels(page: OcrPage): Label[] {
  const labels: Label[] = [];
  for (const { text, confidence, bbox } of collectCandidates(page)) {
    const char = text.trim().toUpperCase();
    if (!isUppercaseLatin(char) || confidence < OCR_MIN_CONFIDENCE) continue;
    labels.push({ char, cx: (bbox.x0 + bbox.x1) / 2, cy: (bbox.y0 + bbox.y1) / 2 });
  }
  // Детерминированный порядок: сверху вниз, слева направо.
  return labels.sort((a, b) => a.cy - b.cy || a.cx - b.cx);
}

/** Переопределяемые пути (браузер — статика из public/; Vitest/Node — node_modules + локальный tessdata). */
export interface OcrRuntimeOptions {
  langPath?: string;
  workerPath?: string;
  corePath?: string;
}

const isNode = typeof process !== 'undefined' && process.versions?.node !== undefined;

/** Локальный bundle без CDN (решение фичи: public/tessdata + public/tesseract). */
function defaultOptions(): OcrRuntimeOptions {
  if (isNode) {
    // Node: воркер и WASM-ядро резолвятся из node_modules; переопределять
    // workerPath/corePath нельзя — сломает node-воркер. Только локальный tessdata.
    return { langPath: 'public/tessdata' };
  }
  return {
    langPath: '/tessdata',
    workerPath: '/tesseract/worker.min.js',
    corePath: '/tesseract',
  };
}

/** Структурный тип воркера — без импорта типов tesseract.js на границе модуля. */
interface TesseractWorkerLike {
  setParameters(params: Record<string, string>): Promise<unknown>;
  recognize(
    image: Uint8Array,
    options?: Record<string, never>,
    output?: { blocks: boolean; text: boolean },
  ): Promise<{ data: OcrPage }>;
}

/** Один воркер на модуль — как cvPromise в lines.ts. */
let workerPromise: Promise<TesseractWorkerLike> | null = null;

async function loadWorker(options: OcrRuntimeOptions): Promise<TesseractWorkerLike> {
  const mod = (await import('tesseract.js')) as unknown as {
    createWorker: (
      langs: string,
      oem?: number,
      opts?: Record<string, unknown>,
    ) => Promise<TesseractWorkerLike>;
  };
  // oem по умолчанию LSTM_ONLY (v7); cacheMethod 'none' — детерминизм без кэш-IO.
  const worker = await mod.createWorker(OCR_LANG, undefined, {
    ...options,
    cacheMethod: 'none',
    gzip: true,
    logger: () => {},
  });
  await worker.setParameters({
    tessedit_pageseg_mode: OCR_PSM,
    tessedit_char_whitelist: OCR_CHAR_WHITELIST,
    user_defined_dpi: OCR_USER_DPI,
  });
  return worker;
}

/**
 * OCR-стадия: RawImage → BMP → воркер → метки вершин (ТЗ §3.1).
 * Асинхронность — только из-за WASM-загрузки; DOM не используется.
 */
export async function recognizeLabels(
  image: RawImage,
  overrides?: OcrRuntimeOptions,
): Promise<Label[]> {
  const options = { ...defaultOptions(), ...overrides };
  workerPromise ??= loadWorker(options);
  const worker = await workerPromise;
  // Явный output: дефолт v7 — только text, blocks не построится.
  const { data } = await worker.recognize(encodeBmp(image), undefined, {
    blocks: true,
    text: false,
  });
  return extractLabels(data);
}
