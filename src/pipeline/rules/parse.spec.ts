import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { parseTask } from './parse';
import type { Relation } from './types';

const testdata = (name: string): string =>
  readFileSync(fileURLToPath(new URL(`../../../testdata/${name}`, import.meta.url)), 'utf-8').trim();

function sortedRelations(relations: Relation[]): Relation[] {
  return [...relations].sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b)));
}

function expectSameRelations(actual: Relation[], expected: Relation[]): void {
  expect(sortedRelations(actual)).toEqual(sortedRelations(expected));
}

describe('parseTask (текст задачи → Rule-JSON, без ИИ)', () => {
  it('acceptance: задача 1 (testdata) → биссектриса + медиана + угол + дано', () => {
    const result = parseTask(testdata('1-text.txt'));
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error('задача 1 обязана парситься оффлайн');
    expect(result.task.points).toEqual(['A', 'B', 'C', 'K', 'M']);
    expectSameRelations(result.task.relations, [
      { kind: 'median', cevian: 'BK', side: 'AC' },
      { kind: 'bisector', cevian: 'BM', angle: 'ABC' },
      { kind: 'angle', angle: 'ABC', degrees: 100 },
    ]);
    expect(result.task.givens).toEqual(['AC = 16 см']);
    expect(result.task.source).toBe('parser');
  });

  it('acceptance: задача 2 (testdata) → медиана + биссектриса + угол + дано', () => {
    const result = parseTask(testdata('2-text.txt'));
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error('задача 2 обязана парситься оффлайн');
    expect(result.task.points).toEqual(['A', 'B', 'C', 'K', 'M']);
    expectSameRelations(result.task.relations, [
      { kind: 'median', cevian: 'BM', side: 'AC' },
      { kind: 'bisector', cevian: 'BK', angle: 'ABC' },
      { kind: 'angle', angle: 'ABC', degrees: 84 },
    ]);
    expect(result.task.givens).toEqual(['AC = 16 м']);
    expect(result.task.source).toBe('parser');
  });

  it('медиана: «медиана BK» в треугольнике ABC → median(BK, сторона AC)', () => {
    const result = parseTask('В треугольнике ABC медиана BK');
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error('ожидаем успех');
    expectSameRelations(result.task.relations, [{ kind: 'median', cevian: 'BK', side: 'AC' }]);
  });

  it('медиана в тире-форме: «BM-медиана треугольника ABC»', () => {
    const result = parseTask('BM-медиана треугольника ABC');
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error('ожидаем успех');
    expectSameRelations(result.task.relations, [{ kind: 'median', cevian: 'BM', side: 'AC' }]);
  });

  it('биссектриса из вершины C → угол ACB (вершина в середине имени)', () => {
    const result = parseTask('В треугольнике ABC проведена биссектриса CM');
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error('ожидаем успех');
    expectSameRelations(result.task.relations, [{ kind: 'bisector', cevian: 'CM', angle: 'ACB' }]);
  });

  it('высота: «высота BM» в треугольнике ABC → height(BM, AC)', () => {
    const result = parseTask('В треугольнике ABC высота BM');
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error('ожидаем успех');
    expectSameRelations(result.task.relations, [{ kind: 'height', cevian: 'BM', side: 'AC' }]);
  });

  it('угловая мера: ∠-форма и форма «угол … = N°»', () => {
    const a = parseTask('∠ABC = 100°');
    const b = parseTask('угол ABC = 90');
    expect(a.ok && b.ok).toBe(true);
    if (!a.ok || !b.ok) throw new Error('ожидаем успех');
    expectSameRelations(a.task.relations, [{ kind: 'angle', angle: 'ABC', degrees: 100 }]);
    expectSameRelations(b.task.relations, [{ kind: 'angle', angle: 'ABC', degrees: 90 }]);
  });

  it('«градусную меру угла ABM» (без значения) не становится правилом', () => {
    const result = parseTask('Найди градусную меру угла ABM');
    expect(result.ok).toBe(false);
  });

  it('параллельность: «AB ∥ CD»', () => {
    const result = parseTask('Прямые AB ∥ CD');
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error('ожидаем успех');
    expectSameRelations(result.task.relations, [{ kind: 'parallel', a: 'AB', b: 'CD' }]);
  });

  it('равенство отрезков: «AB = CD»', () => {
    const result = parseTask('Отрезки AB = CD');
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error('ожидаем успех');
    expectSameRelations(result.task.relations, [{ kind: 'equal', a: 'AB', b: 'CD' }]);
  });

  it('принадлежность точки: формы «принадлежит отрезку» и «лежит на отрезке»', () => {
    const a = parseTask('Точка M принадлежит отрезку AB');
    const b = parseTask('M лежит на отрезке CD');
    expect(a.ok && b.ok).toBe(true);
    if (!a.ok || !b.ok) throw new Error('ожидаем успех');
    expectSameRelations(a.task.relations, [{ kind: 'on-segment', point: 'M', segment: 'AB' }]);
    expectSameRelations(b.task.relations, [{ kind: 'on-segment', point: 'M', segment: 'CD' }]);
  });

  it('длины с единицами → givens без верификации (не путать с равенством отрезков)', () => {
    const a = parseTask('Дано: AC = 16 см');
    const b = parseTask('известно, что AC=16м');
    expect(a.ok && b.ok).toBe(true);
    if (!a.ok || !b.ok) throw new Error('ожидаем успех');
    expect(a.task.givens).toEqual(['AC = 16 см']);
    expect(b.task.givens).toEqual(['AC = 16 м']);
    expect(a.task.relations).toHaveLength(0);
    expect(b.task.relations).toHaveLength(0);
  });

  it('омоглифы: parseTask сам нормализует текст («<АВС=84°»)', () => {
    const result = parseTask('Найдите градусную меру, если <АВС=84°');
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error('ожидаем успех');
    expectSameRelations(result.task.relations, [{ kind: 'angle', angle: 'ABC', degrees: 84 }]);
  });

  it('дубликаты формулировок дают одну связь', () => {
    const result = parseTask('В треугольнике ABC медиана BK, причём BK-медиана');
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error('ожидаем успех');
    expectSameRelations(result.task.relations, [{ kind: 'median', cevian: 'BK', side: 'AC' }]);
  });

  it('пустой текст → мягкая ошибка, не исключение', () => {
    const result = parseTask('');
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error('неожиданный успех');
    expect(result.error.startsWith('[Status: Error]')).toBe(true);
  });

  it('текст без геометрических правил → мягкая ошибка [Status: Error]', () => {
    const result = parseTask('Нарисуй красивый домик');
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error('неожиданный успех');
    expect(result.error.startsWith('[Status: Error]')).toBe(true);
  });

  it('детерминизм: два прогона на задаче 1 дают идентичный результат', () => {
    const text = testdata('1-text.txt');
    const a = parseTask(text);
    const b = parseTask(text);
    expect(a).toEqual(b);
  });
});
