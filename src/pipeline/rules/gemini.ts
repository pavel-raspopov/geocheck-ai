/** Фолбэк-клиент Gemini REST: текст задачи → Rule-JSON v2 (ТЗ §6, решение 2026-09-17). */
import type { AngleName, ParsedTask, ParseResult, Relation, Segment } from './types';

/** Софт-ошибка фолбэка (контракт ТЗ / failure model в `architecture.md`). */
export const GEMINI_SOFT_ERROR = '[Status: Error] Не удалось разобрать текст задачи';

const GEMINI_URL =
  'https://generativelanguage.googleapis.com/v1beta/models/gemini-3.6-flash:generateContent';

/** Минимальный структурный тип fetch-ответа (DI: не зависим от DOM-типов). */
interface FetchResponseLike {
  ok: boolean;
  status: number;
  json(): Promise<unknown>;
}

/** Подменяемый fetch для тестов; в продакшене — глобальный `fetch` (браузер). */
export type FetchLike = (url: string, init?: RequestInit) => Promise<FetchResponseLike>;

/** Подмена сети для тестов; в продакшене все зависимости дефолтные. */
export interface GeminiDeps {
  fetchLike?: FetchLike;
}

const PROMPT = [
  'Ты извлекаешь геометрические правила из текста школьной задачи.',
  'Верни СТРОГО один JSON-объект без markdown и пояснений, по схеме:',
  '{"points": ["A", …], "relations": […], "givens": ["…"]}',
  'points — все упомянутые точки, заглавные латинские буквы.',
  'givens — абсолютные величины вида «AC = 16 см» (не проверяются).',
  'relations — массив объектов строго одного из видов:',
  '{"kind":"angle","angle":"ABC","degrees":90}',
  '{"kind":"parallel","a":"AB","b":"CD"}',
  '{"kind":"equal","a":"AB","b":"CD"}',
  '{"kind":"on-segment","point":"M","segment":"AB"}',
  '{"kind":"median","cevian":"BK","side":"AC"}',
  '{"kind":"bisector","cevian":"BM","angle":"ABC"}',
  '{"kind":"height","cevian":"BM","side":"AC"}',
  'Не выдумывай правила, которых нет в тексте. Задача:',
].join('\n');

const SEGMENT_RE = /^[A-Z]{2}$/;
const ANGLE_RE = /^[A-Z]{3}$/;
const POINT_RE = /^[A-Z]$/;

const fail = (): ParseResult => ({ ok: false, error: GEMINI_SOFT_ERROR });

function normalizeName(value: unknown, re: RegExp): string | null {
  if (typeof value !== 'string') return null;
  const name = value.trim().toUpperCase();
  return re.test(name) ? name : null;
}

/** Строгая валидация Rule-JSON: `null`, если контракт нарушен. */
export function validateRuleJson(raw: unknown): ParsedTask | null {
  if (typeof raw !== 'object' || raw === null) return null;
  const obj = raw as Record<string, unknown>;
  if (!Array.isArray(obj.points) || !Array.isArray(obj.relations)) return null;

  const points = new Set<string>();
  for (const p of obj.points) {
    const name = normalizeName(p, POINT_RE);
    if (name === null) return null;
    points.add(name);
  }

  const givens: string[] = [];
  if (obj.givens !== undefined) {
    if (!Array.isArray(obj.givens)) return null;
    for (const g of obj.givens) {
      if (typeof g !== 'string') return null;
      givens.push(g.trim());
    }
  }

  const relations: Relation[] = [];
  for (const r of obj.relations) {
    const parsed = validateRelation(r);
    if (parsed === null) return null;
    relations.push(parsed);
  }

  return { points: [...points].sort(), relations, givens, source: 'gemini' };
}

function validateRelation(r: unknown): Relation | null {
  if (typeof r !== 'object' || r === null) return null;
  const rel = r as Record<string, unknown>;
  switch (rel.kind) {
    case 'angle': {
      const angle = normalizeName(rel.angle, ANGLE_RE);
      if (angle === null || typeof rel.degrees !== 'number' || !Number.isFinite(rel.degrees)) {
        return null;
      }
      return { kind: 'angle', angle: angle as AngleName, degrees: rel.degrees };
    }
    case 'parallel':
    case 'equal': {
      const a = normalizeName(rel.a, SEGMENT_RE);
      const b = normalizeName(rel.b, SEGMENT_RE);
      if (a === null || b === null) return null;
      return { kind: rel.kind, a: a as Segment, b: b as Segment };
    }
    case 'on-segment': {
      const point = normalizeName(rel.point, POINT_RE);
      const segment = normalizeName(rel.segment, SEGMENT_RE);
      if (point === null || segment === null) return null;
      return { kind: 'on-segment', point, segment: segment as Segment };
    }
    case 'median':
    case 'height': {
      const cevian = normalizeName(rel.cevian, SEGMENT_RE);
      const side = normalizeName(rel.side, SEGMENT_RE);
      if (cevian === null || side === null) return null;
      return { kind: rel.kind, cevian: cevian as Segment, side: side as Segment };
    }
    case 'bisector': {
      const cevian = normalizeName(rel.cevian, SEGMENT_RE);
      const angle = normalizeName(rel.angle, ANGLE_RE);
      if (cevian === null || angle === null) return null;
      return { kind: 'bisector', cevian: cevian as Segment, angle: angle as AngleName };
    }
    default:
      return null;
  }
}

/** Склеивает текстовые части кандидата Gemini; `null`, если текста нет. */
function extractCandidateText(payload: unknown): string | null {
  const parts = (payload as { candidates?: { content?: { parts?: { text?: unknown }[] } }[] })
    .candidates?.[0]?.content?.parts;
  if (!Array.isArray(parts)) return null;
  const texts = parts
    .map((p) => (typeof p?.text === 'string' ? p.text : ''))
    .filter((t) => t.length > 0);
  const text = texts.join('');
  return text.length > 0 ? text : null;
}

/** Срезает markdown-фенсы (defensive: responseMimeType=json обычно без них). */
function stripFences(text: string): string {
  const trimmed = text.trim();
  const fenced = /^```(?:json)?\s*([\s\S]*?)\s*```$/.exec(trimmed);
  return fenced !== null ? (fenced[1] as string).trim() : trimmed;
}

/**
 * Ручной фолбэк: строгий промпт → Rule-JSON → валидация. Любая сетевая ошибка,
 * не-2xx или нарушенный контракт — мягкая ошибка (ТЗ §4), не исключение.
 * Вызывается ТОЛЬКО по явному действию пользователя (human-in-the-loop, фича 11).
 */
export async function extractRulesGemini(
  text: string,
  apiKey: string,
  deps?: GeminiDeps,
): Promise<ParseResult> {
  const doFetch = deps?.fetchLike ?? fetch;

  let response: FetchResponseLike;
  try {
    response = await doFetch(GEMINI_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
      body: JSON.stringify({
        contents: [{ parts: [{ text: `${PROMPT}\n${text}` }] }],
        generationConfig: { responseMimeType: 'application/json', temperature: 0 },
      }),
    });
  } catch {
    return fail();
  }
  if (!response.ok) return fail();

  let payload: unknown;
  try {
    payload = await response.json();
  } catch {
    return fail();
  }

  const candidateText = extractCandidateText(payload);
  if (candidateText === null) return fail();

  let raw: unknown;
  try {
    raw = JSON.parse(stripFences(candidateText));
  } catch {
    return fail();
  }

  const task = validateRuleJson(raw);
  return task !== null ? { ok: true, task } : fail();
}
