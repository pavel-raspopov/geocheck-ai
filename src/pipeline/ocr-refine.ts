/** Refine-проход OCR (калибровка фичи 12): дочитывает метки, слитые с линиями. */
import {
  OCR_REFINE_INK_THRESHOLD,
  OCR_REFINE_LOCATE_MASK_WIDTH,
  OCR_REFINE_LOCATE_RADIUS,
  OCR_REFINE_MASK_WIDTH,
  OCR_REFINE_MIN_CONFIDENCE,
  OCR_REFINE_READ_RADII,
  OCR_REFINE_UPSCALE,
} from './constants';
import type { RawImage } from './lines';
import type { CharCandidate } from './ocr';
import type { Label, LineSegment, Point, Vertex } from './types';

/** Расстояние от точки до отрезка (дублирует graph.ts: локальный хелпер маски). */
function pointSegmentDistance(x: number, y: number, s: LineSegment): number {
  const dx = s.x2 - s.x1;
  const dy = s.y2 - s.y1;
  const lenSq = dx * dx + dy * dy;
  if (lenSq === 0) return Math.hypot(x - s.x1, y - s.y1);
  const t = Math.max(0, Math.min(1, ((x - s.x1) * dx + (y - s.y1) * dy) / lenSq));
  return Math.hypot(x - (s.x1 + t * dx), y - (s.y1 + t * dy));
}

/**
 * Стирает отрезки из растра белой полосой `width` (глитфы меток, слитые с
 * линиями, становятся отдельными компонентами). Полоса минимальна (3 px):
 * широкий мазок рубит сами глифы. Вход не мутирует.
 */
export function maskSegments(image: RawImage, segments: LineSegment[], width: number): RawImage {
  const data = new Uint8ClampedArray(image.data);
  const half = width / 2;
  for (const s of segments) {
    const minX = Math.max(0, Math.floor(Math.min(s.x1, s.x2) - half - 1));
    const maxX = Math.min(image.width - 1, Math.ceil(Math.max(s.x1, s.x2) + half + 1));
    const minY = Math.max(0, Math.floor(Math.min(s.y1, s.y2) - half - 1));
    const maxY = Math.min(image.height - 1, Math.ceil(Math.max(s.y1, s.y2) + half + 1));
    for (let y = minY; y <= maxY; y++) {
      for (let x = minX; x <= maxX; x++) {
        if (pointSegmentDistance(x, y, s) > half) continue;
        const o = (y * image.width + x) * 4;
        data[o] = 255;
        data[o + 1] = 255;
        data[o + 2] = 255;
        data[o + 3] = 255;
      }
    }
  }
  return { width: image.width, height: image.height, data };
}

/**
 * Кроп `2·radius` вокруг целой точки + nearest-апскейл `factor` (сглаживание
 * ломает сегментацию tesseract). Пиксели вне растра — белые.
 */
export function cropUpscale(
  image: RawImage,
  cx: number,
  cy: number,
  radius: number,
  factor: number,
): RawImage {
  const size = radius * 2;
  const width = size * factor;
  const height = size * factor;
  const data = new Uint8ClampedArray(width * height * 4).fill(255);
  for (let dy = 0; dy < size; dy++) {
    const sy = cy - radius + dy;
    if (sy < 0 || sy >= image.height) continue;
    for (let dx = 0; dx < size; dx++) {
      const sx = cx - radius + dx;
      if (sx < 0 || sx >= image.width) continue;
      const src = (sy * image.width + sx) * 4;
      for (let fy = 0; fy < factor; fy++) {
        const row = (dy * factor + fy) * width;
        for (let fx = 0; fx < factor; fx++) {
          const dst = (row + dx * factor + fx) * 4;
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

/**
 * Цели refine: вершины без меток, вокруг которых (в радиусе skipRadius) нет
 * помеченной вершины — иначе re-read рядом с готовой меткой крадёт её глиф.
 */
export function refineTargets(
  vertices: Vertex[],
  graph: Record<string, Vertex>,
  skipRadius: number,
): Point[] {
  const labeled = Object.values(graph);
  return vertices.filter(
    (v) =>
      v.labels.length === 0 &&
      !labeled.some((lv) => Math.hypot(lv.x - v.x, lv.y - v.y) <= skipRadius),
  );
}

/** Подменяемая зависимость: одиночный символ (PSM 10) на кропе. */
export interface RefineDeps {
  recognizeChar: (image: RawImage) => Promise<CharCandidate[]>;
}

/** Центроид тёмных пикселей (глиф на белом); null — если чернил нет. */
export function inkCentroid(image: RawImage, threshold: number): Point | null {
  let sumX = 0;
  let sumY = 0;
  let n = 0;
  for (let y = 0; y < image.height; y++) {
    for (let x = 0; x < image.width; x++) {
      const o = (y * image.width + x) * 4;
      if (image.data[o]! < threshold) {
        sumX += x;
        sumY += y;
        n += 1;
      }
    }
  }
  return n === 0 ? null : { x: sumX / n, y: sumY / n };
}

/**
 * Дочитывает метки у целей (PSM 10, одиночный символ). Стратегия «центроид
 * глифа»: грубая маска отрезков → центроид чернил в окне локализации
 * (глифы слиты с линиями и не лежат на вершине точно) → чтение символа с
 * кропа лёгкой маски с центром на глифе. Позиция метки — координаты вершины
 * (гарантированная привязка). Порядок целей детерминирован.
 */
export async function refineUnboundLabels(
  image: RawImage,
  segments: LineSegment[],
  targets: Point[],
  deps: RefineDeps,
): Promise<Label[]> {
  if (targets.length === 0) return [];
  const locateSource = maskSegments(image, segments, OCR_REFINE_LOCATE_MASK_WIDTH);
  const readSource = maskSegments(image, segments, OCR_REFINE_MASK_WIDTH);
  const labels: Label[] = [];
  for (const target of targets) {
    const cx = Math.round(target.x);
    const cy = Math.round(target.y);
    const localized = cropUpscale(locateSource, cx, cy, OCR_REFINE_LOCATE_RADIUS, 1);
    const centroid = inkCentroid(localized, OCR_REFINE_INK_THRESHOLD);
    if (!centroid) continue;
    const gx = Math.round(centroid.x) + cx - OCR_REFINE_LOCATE_RADIUS;
    const gy = Math.round(centroid.y) + cy - OCR_REFINE_LOCATE_RADIUS;
    let best: { char: string; conf: number } | null = null;
    for (const radius of OCR_REFINE_READ_RADII) {
      const crop = cropUpscale(readSource, gx, gy, radius, OCR_REFINE_UPSCALE);
      for (const candidate of await deps.recognizeChar(crop)) {
        if (
          candidate.confidence >= OCR_REFINE_MIN_CONFIDENCE &&
          (best === null || candidate.confidence > best.conf)
        ) {
          best = { char: candidate.char, conf: candidate.confidence };
        }
      }
      if (best !== null) break; // младший радиус уже дал уверенного кандидата
    }
    if (best !== null) labels.push({ char: best.char, cx: target.x, cy: target.y });
  }
  return labels;
}
