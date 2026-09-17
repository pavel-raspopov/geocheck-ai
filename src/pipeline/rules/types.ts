/** Правила, извлечённые из текста задачи (Rule-JSON v2). Контракт — `context/architecture.md`. */

/** Отрезок по двум вершинам: 'AB', 'BK', … */
export type Segment = `${string}${string}`;

/** Имя угла из трёх вершин (вершина в середине): 'ABC', … */
export type AngleName = `${string}${string}${string}`;

/**
 * Связь между точками чертежа. Медиана = on-segment середины + equal половин,
 * биссектриса = |∠ABM − ∠MBC| ≤ ε, высота = ⊥ + on-line, angle с N=90 —
 * перпендикуляр (ТЗ §2.6, ред. 2026-09-17).
 */
export type Relation =
  | { kind: 'angle'; angle: AngleName; degrees: number }
  | { kind: 'parallel'; a: Segment; b: Segment }
  | { kind: 'equal'; a: Segment; b: Segment }
  | { kind: 'on-segment'; point: string; segment: Segment }
  | { kind: 'median'; cevian: Segment; side: Segment }
  | { kind: 'bisector'; cevian: Segment; angle: AngleName }
  | { kind: 'height'; cevian: Segment; side: Segment };

/** Результат оффлайн-парсинга текста задачи. */
export interface ParsedTask {
  /** Все точки, участвующие в правилах (отсортированы, без дублей). */
  points: string[];
  relations: Relation[];
  /** «Дано»: абсолютные длины — не верифицируются, показываются в UI (ТЗ §6.2). */
  givens: string[];
  source: 'parser' | 'gemini';
}

/** Результат `parseTask`: мягкая ошибка вместо исключения (ТЗ §4). */
export type ParseResult =
  | { ok: true; task: ParsedTask }
  | { ok: false; error: string };
