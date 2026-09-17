import { describe, expect, it } from 'vitest';
import { normalizeTaskText } from './normalize';

describe('normalizeTaskText (нормализация омоглифов и знака угла)', () => {
  it('переводит кириллические омоглифы в латиницу', () => {
    expect(normalizeTaskText('АВС')).toBe('ABC');
    expect(normalizeTaskText('ВМ')).toBe('BM');
    expect(normalizeTaskText('КМН')).toBe('KMH');
    expect(normalizeTaskText('ЕОРТХ')).toBe('EOPTX');
  });

  it('не трогает настоящую латиницу и русские слова', () => {
    expect(normalizeTaskText('биссектриса BM медиана BK')).toBe('биссектриса BM медиана BK');
    expect(normalizeTaskText('треугольнике')).toBe('треугольнике');
  });

  it('«В треугольнике АВС» → «B треугольнике ABC» (омоглиф В заменяется даже в предлоге)', () => {
    expect(normalizeTaskText('В треугольнике АВС')).toBe('B треугольнике ABC');
  });

  it('заменяет < на ∠ вместе с омоглифами', () => {
    expect(normalizeTaskText('<АВС=84°')).toBe('∠ABC=84°');
  });

  it('∠ и латиница остаются без изменений', () => {
    expect(normalizeTaskText('∠ABC=84°')).toBe('∠ABC=84°');
  });

  it('схлопывает пробельные последовательности и обрезает края', () => {
    expect(normalizeTaskText('  АС =\t 16\nсм  ')).toBe('AC = 16 см');
  });

  it('реальный фрагмент задачи 1 нормализуется целиком', () => {
    const raw = 'В треугольнике АВС проведены биссектриса ВМ и медиана ВK. ' +
      'Известно, что АС = 16 см, ∠АВС = 100°.';
    expect(normalizeTaskText(raw)).toBe(
      'B треугольнике ABC проведены биссектриса BM и медиана BK. Известно, что AC = 16 см, ∠ABC = 100°.',
    );
  });

  it('детерминирован: два прогона дают одинаковый результат', () => {
    const raw = '<АВС=84°, ВМ-медиана';
    expect(normalizeTaskText(raw)).toBe(normalizeTaskText(raw));
  });
});
