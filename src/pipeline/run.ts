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
  const segments = deduplicateSegments(await detect(image));
  if (segments.length === 0) {
    return {
      segments: [],
      labels: [],
      vertices: [],
      graph: {},
      unboundLabels: [],
      verdict: emptyVerdict,
    };
  }

  const labels = await recognize(image);
  const { graph, vertices, unboundLabels } = buildGraph(segments, labels);
  const verdict = verify({ graph, rule, epsilon });
  return { segments, labels, vertices, graph, unboundLabels, verdict };
}
