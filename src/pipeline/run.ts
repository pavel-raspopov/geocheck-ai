/** Проводка пайплайна (ТЗ §2): RawImage → вердикт + данные для UI-оверлея. */
import { detectSegments, type RawImage } from './lines';
import { deduplicateSegments } from './dedup';
import { recognizeLabels } from './ocr';
import { buildGraph } from './graph';
import { verify } from './verify';
import type { Label, LineSegment, Rule, Vertex, VerifyResult } from './types';

/** Подмена стадий для тестов; в продакшене все стадии дефолтные. */
export interface PipelineDeps {
  detectSegments?: (image: RawImage) => Promise<LineSegment[]>;
  recognizeLabels?: (image: RawImage) => Promise<Label[]>;
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
 * Полный анализ чертежа: детекция → дедупликация → OCR → граф → verify.
 * Асинхронность — только из-за WASM-стадий; DOM не используется.
 * Пустая детекция — мягкая ошибка (не исключение): UI показывает её как вердикт.
 */
export async function analyzeDrawing(
  image: RawImage,
  rule: Rule,
  epsilon: number,
  deps?: PipelineDeps,
): Promise<PipelineResult> {
  const detect = deps?.detectSegments ?? detectSegments;
  const recognize = deps?.recognizeLabels ?? recognizeLabels;

  const emptyVerdict: VerifyResult = {
    status: 'Error',
    message: '[Status: Error] На чертеже не найдено отрезков',
    epsilon,
  };
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
      verdict: emptyVerdict,
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
  const labels = await recognize(image);
  const recognizeMs = performance.now() - t1;
  const t2 = performance.now();
  const graphResult = buildGraph(segments, labels);
  const graphMs = performance.now() - t2;
  const t3 = performance.now();
  const verdict = verify({ graph: graphResult.graph, rule, epsilon });
  const verifyMs = performance.now() - t3;
  return {
    segments,
    labels,
    vertices: graphResult.vertices,
    graph: graphResult.graph,
    unboundLabels: graphResult.unboundLabels,
    verdict,
    timings: {
      detect: detectMs,
      recognize: recognizeMs,
      graph: graphMs,
      verify: verifyMs,
      total: performance.now() - t0,
    },
  };
}
