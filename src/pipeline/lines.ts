/** Стадия 1 пайплайна (ТЗ §2): детекция отрезков ≥ 30 px из растрового чертежа. */
import type { CV } from '@techstark/opencv-js';
import type { Mat } from '@techstark/opencv-js';
import {
  CANNY_HIGH,
  CANNY_LOW,
  HOUGH_MAX_GAP,
  HOUGH_THRESHOLD,
  MIN_SEGMENT_LENGTH,
} from './constants';
import type { LineSegment } from './types';

/** Растровое изображение без DOM-типов: структурный аналог ImageData. */
export interface RawImage {
  width: number;
  height: number;
  /** RGBA, 4 байта на пиксель, row-major. */
  data: Uint8ClampedArray;
}

/** Недотипизированная часть модуля opencv-js до полной инициализации WASM. */
interface CvLike {
  Mat?: unknown;
  onRuntimeInitialized?: () => void;
  [key: string]: unknown;
}

/** Одиночная ленивая загрузка тяжёлого WASM-модуля OpenCV.js. */
let cvPromise: Promise<CV> | null = null;

function loadCv(): Promise<CV> {
  cvPromise ??= (async () => {
    // Интероп-адаптер (см. opencv-interop.ts): default — обещание cv либо сам cv.
    const mod = (await import('./opencv-interop')) as unknown as {
      default: Promise<CvLike> | CvLike;
    };
    const cv = mod.default instanceof Promise ? await mod.default : mod.default;
    await waitRuntimeInitialized(cv);
    return cv as CV;
  })();
  return cvPromise;
}

/** Ожидание готовности WASM: колбэк может уже отработать — дополняем опросом. */
function waitRuntimeInitialized(cv: CvLike): Promise<void> {
  if (cv.Mat) return Promise.resolve();
  return new Promise<void>((resolve) => {
    cv.onRuntimeInitialized = () => resolve();
    const poll = (): void => {
      if (cv.Mat) resolve();
      else setTimeout(poll, 50);
    };
    setTimeout(poll, 50);
  });
}

/**
 * Детекция отрезков: grayscale → Canny → HoughLinesP → фильтр < 30 px.
 * Чистая функция над данными (без DOM); асинхронность — только из-за WASM-загрузки.
 */
export async function detectSegments(image: RawImage): Promise<LineSegment[]> {
  const cv = await loadCv();
  const rgba = cv.matFromArray(image.height, image.width, cv.CV_8UC4, image.data);
  const gray = new cv.Mat();
  const edges = new cv.Mat();
  const hough = new cv.Mat();
  try {
    // Canny обязателен перед Hough: непустые пиксели = точки-кандидаты,
    // белый фон без Canny «заливает» аккумулятор (симптом — диагонали ±45°).
    cv.cvtColor(rgba, gray, cv.COLOR_RGBA2GRAY);
    cv.Canny(gray, edges, CANNY_LOW, CANNY_HIGH, 3, false);
    cv.HoughLinesP(
      edges,
      hough,
      1,
      Math.PI / 180,
      HOUGH_THRESHOLD,
      MIN_SEGMENT_LENGTH,
      HOUGH_MAX_GAP,
    );
    return extractSegments(hough);
  } finally {
    rgba.delete();
    gray.delete();
    edges.delete();
    hough.delete();
  }
}

/** Разбор результата HoughLinesP: одна строка CV_32SC4, по 4 int32 на сегмент. */
function extractSegments(hough: Mat): LineSegment[] {
  const data = hough.data32S;
  const count = Math.floor(data.length / 4);
  const found: Omit<LineSegment, 'id'>[] = [];
  for (let i = 0; i < count; i++) {
    const base = i * 4;
    const x1 = data[base];
    const y1 = data[base + 1];
    const x2 = data[base + 2];
    const y2 = data[base + 3];
    if (x1 === undefined || y1 === undefined || y2 === undefined || x2 === undefined) {
      continue;
    }
    if (Math.hypot(x2 - x1, y2 - y1) >= MIN_SEGMENT_LENGTH) {
      found.push({ x1, y1, x2, y2 });
    }
  }
  // Детерминированный порядок: убывание длины, при равенстве — по координатам.
  const lengthOf = (s: { x1: number; y1: number; x2: number; y2: number }): number =>
    Math.hypot(s.x2 - s.x1, s.y2 - s.y1);
  found.sort((a, b) => lengthOf(b) - lengthOf(a) || a.y1 - b.y1 || a.x1 - b.x1);
  return found.map((s, index) => ({ id: `seg-${index}`, ...s }));
}
