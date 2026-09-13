/**
 * Интероп-адаптер @techstark/opencv-js (UMD/CJS).
 *
 * default-экспорт UMD-пакета — обещание cv-модуля, а обёртка сборщика
 * (`__toESM`) создаёт namespace через Object.create(prototype(default)),
 * то есть наследует прототип Promise. Такой объект выглядит thenable, и при
 * прохождении через promise-разрешение (динамический импорт → .then-цепочка
 * vite:preload) движок вызывает на нём Promise.prototype.then →
 * «TypeError: Method Promise.prototype.then called on incompatible receiver».
 * Поэтому разворачиваем обёртки заранее, на уровне модуля, не проводя их
 * через await; реальное обещание или готовый объект уходит наружу как значение.
 */
import type { CV } from '@techstark/opencv-js';
import * as cvNamespace from '@techstark/opencv-js';

/** Разворачивает цепочку {default: …} до реального значения (без бесконечного цикла). */
function unwrapInterop(value: unknown): unknown {
  let current: unknown = value;
  for (let i = 0; i < 4; i++) {
    if (typeof current !== 'object' || current === null) return current;
    if (!Object.prototype.hasOwnProperty.call(current, 'default')) return current;
    const next = (current as { default?: unknown }).default;
    if (next === undefined || next === current) return current;
    current = next;
  }
  return current;
}

const cvValue = unwrapInterop(cvNamespace);

/** Обещание cv-модуля (браузер) либо готовый cv (Node) — контракт lines.ts. */
export default cvValue as Promise<CV> | CV;
