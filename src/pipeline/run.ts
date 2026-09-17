/** Пайплайн GeoCheck (ТЗ §2): RawImage → вердикт + данные для UI-оверлея. */
import { detectSegments, type RawImage } from './lines';
import { deduplicateSegments } from './dedup';
import { recognizeChar, recognizeLabels, type CharCandidate } from './ocr';
import { refineTargets, refineUnboundLabels } from './ocr-refine';
import { OCR_REFINE_SKIP_RADIUS } from './constants';
import { buildGraph } from './graph';
import { verify } from './verify';
import type { Label, LineSegment, Rule, Vertex, VerifyResult } from './types';

/** Результат анализа без вердикта: вход для мульт-проверки `evaluateRules` (фича 11). */
export type AnalyzeResult = Omit<PipelineResult, 'verdict'>;

/** Подмена стадий для тестов; в продакшене все стадии дефолтные. */
export interface PipelineDeps {
  detectSegments?: (image: RawImage) => Promise<LineSegment[]>;
  recognizeLabels?: (image: RawImage) => Promise<Label[]>;
  /** Refine-проход: одиночный символ (PSM 10) на кропе остатка. */
  recognizeChar?: (image: RawImage) => Promise<CharCandidate[]>;
}

/** Полный результат анализа: вход для UI (вердикт + оверлей + софт-ноты). */
export interface PipelineResult {
  readonly segments: LineSegment[];
  readonly labels: Label[];
  readonly vertices: Vertex[];
  readonly graph: Record<string, Vertex>;
  readonly unboundLabels: Label[];
  readonly verdict: VerifyResult;
  /** Длительности стадий, мс (performance.now; бюджет ТЗ — весь анализ ≤ 3 s). */
  readonly timings: StageTimings;
}

/** Длительности стадий, мс (performance.now; бюджет ТЗ — весь анализ ≤ 3 s). */
export interface StageTimings {
  readonly detect: number;
  readonly recognize: number;
  readonly graph: number;
  readonly verify: number;
  readonly total: number;
}

/**
 * Анализ чертежа без проверки правил: детекция → дедупликация → OCR → граф.
 * Асинхронность — только из-за WASM-стадий; DOM не используется.
 * Результат — вход для мульт-проверки `evaluateRules` (фича 11).
 */
export async function analyzeImage(image: RawImage, deps?: PipelineDeps): Promise<AnalyzeResult> {
  const detect = deps?.detectSegments ?? detectSegments;
  const recognize = deps?.recognizeLabels ?? recognizeLabels;

  const t0 = performance.now();
  const detected = await detect(image);
  const detectMs = performance.now() - t0;
  const segments = deduplicateSegments(detected);
  if (segments.length === 0) {
    return {
      segments: [],
      labels: [],
      vertices: [],
      graph: {},
      unboundLabels: [],
      timings: {
        detect: detectMs,
        recognize: 0,
        graph: 0,
        verify: 0,
        total: performance.now() - t0,
      },
    };
  }

  const t1 = performance.now();
  const baseLabels = await recognize(image);
  let graphResult = buildGraph(segments, baseLabels);

  // Refine-проход: дочитывает метки, слитые с линиями (калибровка фичи 12).
  const targets = refineTargets(graphResult.vertices, graphResult.graph, OCR_REFINE_SKIP_RADIUS);
  let labels = baseLabels;
  if (targets.length > 0) {
    const extra = await refineUnboundLabels(image, segments, targets, {
      recognizeChar: deps?.recognizeChar ?? recognizeChar,
    });
    if (extra.length > 0) {
      labels = [...baseLabels, ...extra];
      graphResult = buildGraph(segments, labels);
    }
  }
  const recognizeMs = performance.now() - t1;
  const t2 = performance.now();
  const graphMs = performance.now() - t2;
  return {
    segments,
    labels,
    vertices: graphResult.vertices,
    graph: graphResult.graph,
    unboundLabels: graphResult.unboundLabels,
    timings: {
      detect: detectMs,
      recognize: recognizeMs,
      graph: graphMs,
      verify: 0,
      total: performance.now() - t0,
    },
  };
}

/**
 * Полный анализ чертежа v1 (single-rule): analyzeImage + verify.
 * Держится для существующих тестов и совместимости; UI v2 использует
 * `analyzeImage` + `evaluateRules` напрямую.
 */
export async function analyzeDrawing(
  image: RawImage,
  rule: Rule,
  epsilon: number,
  deps?: PipelineDeps,
): Promise<PipelineResult> {
  const analysis = await analyzeImage(image, deps);
  const t3 = performance.now();
  const verdict = verify({ graph: analysis.graph, rule, epsilon });
  const verifyMs = performance.now() - t3;
  const emptyVerdict: VerifyResult = {
    status: 'Error',
    message: '[Status: Error] На чертеже не найдено отрезков',
    epsilon,
  };
  return {
    ...analysis,
    verdict: analysis.segments.length === 0 ? emptyVerdict : verdict,
    timings: { ...analysis.timings, verify: verifyMs, total: analysis.timings.total + verifyMs },
  };
}
