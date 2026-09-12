import { EPS_MAX, EPS_MIN, EPS_STEP, formatEpsilon } from './types';

/** Ползунок ε: 0.5–10, шаг 0.5; значение — в моноширинном `output`. */
export function createEpsilonSlider(value: number, onChange: (value: number) => void): HTMLElement {
  const label = document.createElement('label');
  label.className = 'field';

  const row = document.createElement('span');
  row.className = 'field-label';
  row.textContent = 'Погрешность ε';

  const output = document.createElement('output');
  output.className = 'mono';

  const range = document.createElement('input');
  range.type = 'range';
  range.id = 'eps-range';
  range.className = 'range-input';
  range.min = String(EPS_MIN);
  range.max = String(EPS_MAX);
  range.step = String(EPS_STEP);
  range.value = String(value);
  output.htmlFor = 'eps-range';
  output.textContent = formatEpsilon(value);

  range.addEventListener('input', () => {
    const next = Number(range.value);
    output.textContent = formatEpsilon(next);
    onChange(next);
  });

  label.append(row, output, range);
  return label;
}
