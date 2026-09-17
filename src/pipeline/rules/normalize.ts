/**
 * Нормализация текста задачи перед парсингом (ТЗ §2.6, ред. 2026-09-17):
 * кириллические омоглифы → латиница, `<` → `∠`, пробелы схлопываются.
 * Чистая функция: без DOM, без I/O.
 */

/** Кириллические буквы-омоглифы, неотличимые в тексте задачи от латиницы. */
const HOMOGLYPHS: Record<string, string> = {
  А: 'A',
  В: 'B',
  С: 'C',
  К: 'K',
  М: 'M',
  Н: 'H',
  Е: 'E',
  О: 'O',
  Р: 'P',
  Т: 'T',
  Х: 'X',
};

const HOMOGLYPH_RE = /[АВСКМНЕОРТХ]/g;

export function normalizeTaskText(raw: string): string {
  return raw
    .replace(HOMOGLYPH_RE, (ch) => HOMOGLYPHS[ch] ?? ch)
    .replace(/</g, '∠')
    .replace(/\s+/g, ' ')
    .trim();
}
