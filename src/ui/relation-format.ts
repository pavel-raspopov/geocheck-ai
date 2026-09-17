/** Человекочитаемые RU-строки для распознанных правил (фича 11: предпросмотр + чеклист). */
import type { ParsedTask, Relation } from '../pipeline/rules/types';

/** Одно правило → строка предпросмотра («∠ABC = 90°», «BK — медиана к стороне AC»). */
export function formatRelation(r: Relation): string {
  switch (r.kind) {
    case 'angle':
      return `∠${r.angle} = ${r.degrees}°`;
    case 'parallel':
      return `${r.a} ∥ ${r.b}`;
    case 'equal':
      return `|${r.a}| = |${r.b}|`;
    case 'on-segment':
      return `${r.point} ∈ ${r.segment}`;
    case 'median':
      return `${r.cevian} — медиана к стороне ${r.side}`;
    case 'bisector':
      return `${r.cevian} — биссектриса угла ${r.angle}`;
    case 'height':
      return `${r.cevian} — высота к стороне ${r.side}`;
  }
}

export interface TaskSummary {
  readonly rules: string[];
  readonly givens: string[];
}

/** ParsedTask → списки строк для UI (правила + «дано»). */
export function formatTaskSummary(task: ParsedTask): TaskSummary {
  return { rules: task.relations.map(formatRelation), givens: [...task.givens] };
}
