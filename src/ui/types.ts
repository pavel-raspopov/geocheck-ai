import type { RawImage } from '../pipeline/lines';
import type { StageTimings, AnalyzeResult } from '../pipeline/run';
import { EPS_DEFAULT } from '../pipeline/constants';
import type { DemoDrawing } from '../mock/demo-drawings';
import { IDEAL_DEMO, DEMO_TASK_TEXT } from '../mock/demo-drawings';
import type { ParseResult, ParsedTask } from '../pipeline/rules/types';
import type { RulesEvaluation } from '../pipeline/rules/rules-engine';

/** Границы ползунка ε (build-plan 01: 0.5–10, шаг 0.5). */
export const EPS_MIN = 0.5;
export const EPS_MAX = 10;
export const EPS_STEP = 0.5;

/** Текущее состояние SPA — обычные данные; обновляется через app.ts. */
export interface AppState {
  demo: DemoDrawing;
  /** Текст задачи в textarea. */
  taskText: string;
  /** Результат последнего разбора текста (парсер или Gemini); null — ещё не разбирали. */
  parsed: ParseResult | null;
  /** Подтверждённые пользователем правила (human-in-the-loop шлюз). */
  confirmed: ParsedTask | null;
  epsilon: number;
  /** Object URL превью загруженного изображения (null — демо-чертёж). */
  imageUrl: string | null;
  /** Последний выбранный файл — источник повторного анализа. */
  file: File | null;
  /** Результат анализа изображения без вердикта (null — демо-режим или ещё не анализировали). */
  analysis: AnalyzeResult | null;
  /** Декодированное изображение для пайплайна (null — демо-режим или ещё не декодировали). */
  raw: RawImage | null;
  /** Идёт полный анализ (OCR/OpenCV) — кнопка заблокирована. */
  analyzing: boolean;
  /** Идёт запрос к Gemini. */
  extracting: boolean;
  /** Последняя мульт-проверка (для чеклиста вердикта). */
  lastEvaluation: RulesEvaluation | null;
}

export function createInitialState(): AppState {
  return {
    demo: IDEAL_DEMO,
    taskText: DEMO_TASK_TEXT,
    parsed: null,
    confirmed: null,
    epsilon: EPS_DEFAULT,
    imageUrl: null,
    file: null,
    analysis: null,
    raw: null,
    analyzing: false,
    extracting: false,
    lastEvaluation: null,
  };
}

/** Числа в UI: одна десятичная (шаг ползунка 0.5), моноширинно. */
export function formatEpsilon(value: number): string {
  return value.toFixed(1);
}

/** Строка времени анализа для verdict-card (tabular-nums задаёт CSS). */
export function formatTimings(t: StageTimings): string {
  const sec = (ms: number): string => (ms / 1000).toFixed(2);
  return `CV ${sec(t.detect)} с · OCR ${sec(t.recognize)} с · всего ${sec(t.total)} с`;
}
