import { normalizeTaskText } from './normalize';
import type { AngleName, ParsedTask, ParseResult, Relation, Segment } from './types';

/** Мягкая ошибка, когда ни правила, ни «дано» извлечь не удалось (ТЗ §4). */
const PARSE_EMPTY_ERROR = '[Status: Error] Не удалось извлечь правила из текста задачи';

/* --- Лексика задачника (вход — текст после normalizeTaskText) ------------- */

/** Треугольник: «треугольнике ABC», «треугольника АВС» (после нормализации). */
const TRIANGLE_RE = /треугольник[а-яё]*\s+([A-Z])([A-Z])([A-Z])/;

/** Чевиана, существительное вперёд: «медиана BK», «биссектриса BM», «высота BM». */
const CEVIAN_NOUN_RE = /(медиана|биссектриса|высота)\s+([A-Z])([A-Z])/g;

/** Чевиана через тире: «BK-медиана», «BM — биссектриса». */
const CEVIAN_DASH_RE = /([A-Z])([A-Z])\s*[-—–]\s*(медиана|биссектриса|высота)/g;

/** Градусная мера: «∠ABC = 100°», «угол ABC = 90» (после нормализации `<` → `∠`). */
const ANGLE_MEASURE_RE = /(?:∠|угол[а-яё]*)\s*([A-Z])([A-Z])([A-Z])\s*=\s*(\d+(?:[.,]\d+)?)\s*°?/g;

/** Параллельность: «AB ∥ CD». */
const PARALLEL_RE = /([A-Z])([A-Z])\s*∥\s*([A-Z])([A-Z])/g;

/** Равенство отрезков: «AB = CD». */
const EQUAL_RE = /([A-Z])([A-Z])\s*=\s*([A-Z])([A-Z])/g;

/** Принадлежность точки: «M принадлежит отрезку AB». */
const ON_BELONGS_RE = /([A-Z])\s+принадлежит\s+отрезк[уа-яё]*\s+([A-Z])([A-Z])/g;

/** …и «M лежит на отрезке AB». */
const ON_LIES_RE = /([A-Z])\s+лежит\s+на\s+отрезк[а-яё]*\s+([A-Z])([A-Z])/g;

/** Абсолютная длина: «AC = 16 см», «AC=16м» — только «дано», не правило. */
const LENGTH_RE = /([A-Z])([A-Z])\s*=\s*(\d+(?:[.,]\d+)?)\s*(мм|см|дм|км|м)/g;

interface Cevian {
  kind: 'median' | 'bisector' | 'height';
  vertex: string;
  foot: string;
}

/** Все совпадения глобального regex (lastIndex сбрасывается — regex переиспользуем). */
function scan(re: RegExp, text: string): RegExpExecArray[] {
  const out: RegExpExecArray[] = [];
  re.lastIndex = 0;
  for (let m = re.exec(text); m !== null; m = re.exec(text)) {
    out.push(m);
    if (m[0].length === 0) break; // защита от зависания на пустом совпадении
  }
  return out;
}

/** Закрывает совпадение пробелами той же длины (индексы остальных совпадений не плывут). */
function blank(text: string, m: RegExpExecArray): string {
  return text.slice(0, m.index) + ' '.repeat(m[0].length) + text.slice(m.index + m[0].length);
}

function distinct(...letters: string[]): boolean {
  return new Set(letters).size === letters.length;
}

function seg(a: string, b: string): Segment {
  return `${a}${b}` as Segment;
}

/** Буквы вершин, участвующие в связи. */
function relationLetters(r: Relation): string[] {
  switch (r.kind) {
    case 'angle':
      return [r.angle.charAt(0), r.angle.charAt(1), r.angle.charAt(2)];
    case 'parallel':
    case 'equal':
      return [r.a.charAt(0), r.a.charAt(1), r.b.charAt(0), r.b.charAt(1)];
    case 'on-segment':
      return [r.point, r.segment.charAt(0), r.segment.charAt(1)];
    case 'median':
    case 'height':
      return [r.cevian.charAt(0), r.cevian.charAt(1), r.side.charAt(0), r.side.charAt(1)];
    case 'bisector':
      return [
        r.cevian.charAt(0),
        r.cevian.charAt(1),
        r.angle.charAt(0),
        r.angle.charAt(1),
        r.angle.charAt(2),
      ];
  }
}

/**
 * Разбирает текст задачи в Rule-JSON. Входной текст нормализуется внутри
 * (омоглифы → латиница, `<` → `∠`). Чистая функция: без DOM, без I/O,
 * детерминирована. Если не извлечено ни одного правила и ни одного «дано» —
 * мягкая ошибка, не исключение (ТЗ §4).
 */
export function parseTask(rawText: string): ParseResult {
  const text = normalizeTaskText(rawText);

  /* Треугольник — источник «противоположной стороны» для чевиан. */
  const triMatch = TRIANGLE_RE.exec(text);
  const triangle: string[] = [];
  if (triMatch) {
    const letters = [triMatch[1]!, triMatch[2]!, triMatch[3]!];
    if (distinct(...letters)) triangle.push(...letters);
  }

  const relations: Relation[] = [];
  const seen = new Set<string>();
  const push = (r: Relation): void => {
    const key = JSON.stringify(r);
    if (!seen.has(key)) {
      seen.add(key);
      relations.push(r);
    }
  };

  /* Чевианы (медиана/биссектриса/высота) в обеих формах записи. */
  const cevians: Cevian[] = [];
  const kindOf = (word: string): Cevian['kind'] =>
    word === 'медиана' ? 'median' : word === 'биссектриса' ? 'bisector' : 'height';
  for (const m of scan(CEVIAN_NOUN_RE, text)) {
    cevians.push({ kind: kindOf(m[1]!), vertex: m[2]!, foot: m[3]! });
  }
  for (const m of scan(CEVIAN_DASH_RE, text)) {
    cevians.push({ kind: kindOf(m[3]!), vertex: m[1]!, foot: m[2]! });
  }
  for (const c of cevians) {
    if (c.foot === c.vertex) continue;
    const [o1, o2] = triangle.filter((l) => l !== c.vertex);
    if (!o1 || !o2) continue; // вершина чевианы не из треугольника (или треугольника нет)
    if (c.kind === 'bisector') {
      push({
        kind: 'bisector',
        cevian: seg(c.vertex, c.foot),
        angle: `${o1}${c.vertex}${o2}` as AngleName,
      });
    } else {
      push({ kind: c.kind, cevian: seg(c.vertex, c.foot), side: seg(o1, o2) });
    }
  }

  /* Градусные меры углов — совпадения вырезаются, чтобы не красть «= N» у других паттернов. */
  let rest = text;
  for (const m of scan(ANGLE_MEASURE_RE, rest)) {
    const [a, v, c, deg] = [m[1]!, m[2]!, m[3]!, m[4]!];
    const degrees = Number(deg.replace(',', '.'));
    if (distinct(a, v, c) && degrees > 0 && degrees <= 180) {
      push({ kind: 'angle', angle: `${a}${v}${c}` as AngleName, degrees });
    }
    rest = blank(rest, m);
  }

  for (const m of scan(PARALLEL_RE, rest)) {
    const [a1, a2, b1, b2] = [m[1]!, m[2]!, m[3]!, m[4]!];
    if (distinct(a1, a2) && distinct(b1, b2)) {
      push({ kind: 'parallel', a: seg(a1, a2), b: seg(b1, b2) });
    }
    rest = blank(rest, m);
  }

  for (const m of scan(EQUAL_RE, rest)) {
    const [a1, a2, b1, b2] = [m[1]!, m[2]!, m[3]!, m[4]!];
    if (distinct(a1, a2) && distinct(b1, b2)) {
      push({ kind: 'equal', a: seg(a1, a2), b: seg(b1, b2) });
    }
    rest = blank(rest, m);
  }

  for (const re of [ON_BELONGS_RE, ON_LIES_RE]) {
    for (const m of scan(re, rest)) {
      const point = m[1]!;
      const [s1, s2] = [m[2]!, m[3]!];
      if (point !== s1 && point !== s2 && distinct(s1, s2)) {
        push({ kind: 'on-segment', point, segment: seg(s1, s2) });
      }
      rest = blank(rest, m);
    }
  }

  /* Абсолютные длины → «дано» (после правил, чтобы не перехватить их совпадения). */
  const givens: string[] = [];
  for (const m of scan(LENGTH_RE, rest)) {
    const value = m[3]!.replace(',', '.');
    givens.push(`${m[1]}${m[2]} = ${value} ${m[4]}`);
  }

  if (relations.length === 0 && givens.length === 0) {
    return { ok: false, error: PARSE_EMPTY_ERROR };
  }

  const points = [...new Set(relations.flatMap(relationLetters))].sort();
  const task: ParsedTask = { points, relations, givens, source: 'parser' };
  return { ok: true, task };
}
