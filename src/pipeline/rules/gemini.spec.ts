import { describe, expect, it } from 'vitest';
import { extractRulesGemini, GEMINI_SOFT_ERROR } from './gemini';
import type { FetchLike } from './gemini';

interface Call {
  url: string;
  init?: RequestInit | undefined;
}

function fakeFetch(body: unknown, ok = true, status = 200): { fetch: FetchLike; calls: Call[] } {
  const calls: Call[] = [];
  const fetch: FetchLike = async (url, init) => {
    calls.push({ url, init });
    return { ok, status, json: async () => body };
  };
  return { fetch, calls };
}

/** Стандартный успешный ответ Gemini: текст кандидата = Rule-JSON. */
function geminiBody(ruleJson: string): unknown {
  return { candidates: [{ content: { parts: [{ text: ruleJson }] } }] };
}

const VALID_RULE = JSON.stringify({
  points: ['A', 'B', 'C', 'M'],
  relations: [
    { kind: 'median', cevian: 'BM', side: 'AC' },
    { kind: 'angle', angle: 'ABC', degrees: 100 },
  ],
  givens: ['AC = 16 см'],
});

describe('extractRulesGemini (фолбэк: текст задачи → Rule-JSON через Gemini REST)', () => {
  it('happy path: валидный Rule-JSON → ok, source=gemini, DI-fetch получил URL/headers/body', async () => {
    const { fetch, calls } = fakeFetch(geminiBody(VALID_RULE));
    const result = await extractRulesGemini('В треугольнике ABC…', 'test-key', {
      fetchLike: fetch,
    });
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error('валидный ответ обязан парситься');
    expect(result.task.source).toBe('gemini');
    expect(result.task.points).toEqual(['A', 'B', 'C', 'M']);
    expect(result.task.relations).toEqual([
      { kind: 'median', cevian: 'BM', side: 'AC' },
      { kind: 'angle', angle: 'ABC', degrees: 100 },
    ]);
    expect(result.task.givens).toEqual(['AC = 16 см']);
    expect(calls).toHaveLength(1);
    const { url, init } = calls[0] as Call;
    expect(url).toBe(
      'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent',
    );
    expect(init?.method).toBe('POST');
    if (init?.headers === undefined) throw new Error('запрос обязан нести headers');
    expect((init.headers as Record<string, string>)['x-goog-api-key']).toBe('test-key');
    const sent = JSON.parse(String(init?.body)) as {
      contents: { parts: { text: string }[] }[];
      generationConfig: { responseMimeType: string };
    };
    expect(sent.generationConfig.responseMimeType).toBe('application/json');
    expect(sent.contents[0]?.parts[0]?.text).toContain('В треугольнике ABC…');
  });

  it('markdown-фенсы вокруг JSON срезаются', async () => {
    const fenced = '```json\n' + VALID_RULE + '\n```';
    const { fetch } = fakeFetch(geminiBody(fenced));
    const result = await extractRulesGemini('текст', 'k', { fetchLike: fetch });
    expect(result.ok).toBe(true);
  });

  it('невалидный JSON в тексте ответа → мягкая ошибка', async () => {
    const { fetch } = fakeFetch(geminiBody('{ не json'));
    const result = await extractRulesGemini('текст', 'k', { fetchLike: fetch });
    expect(result).toEqual({ ok: false, error: GEMINI_SOFT_ERROR });
  });

  it('неизвестный kind в relations → мягкая ошибка', async () => {
    const bad = JSON.stringify({
      points: ['A', 'B'],
      relations: [{ kind: 'circle', a: 'AB' }],
      givens: [],
    });
    const { fetch } = fakeFetch(geminiBody(bad));
    const result = await extractRulesGemini('текст', 'k', { fetchLike: fetch });
    expect(result).toEqual({ ok: false, error: GEMINI_SOFT_ERROR });
  });

  it('сегмент не из двух букв → мягкая ошибка', async () => {
    const bad = JSON.stringify({
      points: ['A', 'B', 'C'],
      relations: [{ kind: 'parallel', a: 'ABC', b: 'DE' }],
      givens: [],
    });
    const { fetch } = fakeFetch(geminiBody(bad));
    const result = await extractRulesGemini('текст', 'k', { fetchLike: fetch });
    expect(result).toEqual({ ok: false, error: GEMINI_SOFT_ERROR });
  });

  it('degrees не число → мягкая ошибка', async () => {
    const bad = JSON.stringify({
      points: ['A', 'B', 'C'],
      relations: [{ kind: 'angle', angle: 'ABC', degrees: '90' }],
      givens: [],
    });
    const { fetch } = fakeFetch(geminiBody(bad));
    const result = await extractRulesGemini('текст', 'k', { fetchLike: fetch });
    expect(result).toEqual({ ok: false, error: GEMINI_SOFT_ERROR });
  });

  it('буквы нормализуются: trim + uppercase', async () => {
    const loose = JSON.stringify({
      points: [' a ', 'b', 'C', 'M'],
      relations: [{ kind: 'median', cevian: 'bm', side: ' ac' }],
      givens: [],
    });
    const { fetch } = fakeFetch(geminiBody(loose));
    const result = await extractRulesGemini('текст', 'k', { fetchLike: fetch });
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error('нормализованный ответ обязан парситься');
    expect(result.task.points).toEqual(['A', 'B', 'C', 'M']);
    expect(result.task.relations).toEqual([{ kind: 'median', cevian: 'BM', side: 'AC' }]);
  });

  it('HTTP 400 → мягкая ошибка, JSON не парсится как правила', async () => {
    const { fetch } = fakeFetch({ error: { message: 'bad key' } }, false, 400);
    const result = await extractRulesGemini('текст', 'k', { fetchLike: fetch });
    expect(result).toEqual({ ok: false, error: GEMINI_SOFT_ERROR });
  });

  it('network reject от fetch → мягкая ошибка', async () => {
    const fetch: FetchLike = async () => {
      throw new Error('network down');
    };
    const result = await extractRulesGemini('текст', 'k', { fetchLike: fetch });
    expect(result).toEqual({ ok: false, error: GEMINI_SOFT_ERROR });
  });

  it('пустой candidates (safety-block) → мягкая ошибка', async () => {
    const { fetch } = fakeFetch({ candidates: [] });
    const result = await extractRulesGemini('текст', 'k', { fetchLike: fetch });
    expect(result).toEqual({ ok: false, error: GEMINI_SOFT_ERROR });
  });
});
