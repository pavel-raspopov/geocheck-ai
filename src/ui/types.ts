import type { Rule, VerifyResult } from '../pipeline/types';
import { EPS_DEFAULT } from '../pipeline/constants';
import type { DemoDrawing } from '../mock/demo-drawings';
import type { PipelineResult } from '../pipeline/run';
import { IDEAL_DEMO } from '../mock/demo-drawings';

/** Вариант правила для выпадающего списка (русская подпись — UI-контракт). */
export interface RuleOption {
  readonly value: Rule;
  readonly label: string;
}

/** Четыре правила движка (порядок — из ТЗ). */
export const RULE_OPTIONS: readonly RuleOption[] = [
  { value: 'perpendicular', label: 'Перпендикулярность (∠ABC = 90°)' },
  { value: 'parallel', label: 'Параллельность (AB ∥ CD)' },
  { value: 'equal-segments', label: 'Равенство отрезков (AB = CD)' },
  { value: 'point-on-segment', label: 'Принадлежность точки (M ∈ AB)' },
];

/** Границы ползунка ε (build-plan 01: 0.5–10, шаг 0.5). */
export const EPS_MIN = 0.5;
export const EPS_MAX = 10;
export const EPS_STEP = 0.5;

/** Текущее состояние SPA — обычные данные; обновляется через app.ts. */
export interface AppState {
  demo: DemoDrawing;
  rule: Rule;
  epsilon: number;
  /** Object URL превью загруженного изображения (null — демо-чертёж). */
  imageUrl: string | null;
  /** Последний выбранный файл — источник повторного анализа. */
  file: File | null;
  /** Результат полного пайплайна (null — демо-режим или ещё не анализировали). */
  analysis: PipelineResult | null;
  /** Идёт полный анализ (OCR/OpenCV) — кнопка заблокирована. */
  analyzing: boolean;
  lastVerdict: VerifyResult | null;
}

export function createInitialState(): AppState {
  return {
    demo: IDEAL_DEMO,
    rule: 'perpendicular',
    epsilon: EPS_DEFAULT,
    imageUrl: null,
    file: null,
    analysis: null,
    analyzing: false,
    lastVerdict: null,
  };
}

/** Числа в UI: одна десятичная (шаг ползунка 0.5), моноширинно. */
export function formatEpsilon(value: number): string {
  return value.toFixed(1);
}
