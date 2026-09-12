import type { Rule } from '../pipeline/types';
import { RULE_OPTIONS } from './types';

/** Поле выбора правила (нативный select, русские подписи). */
export function createRuleSelect(value: Rule, onChange: (rule: Rule) => void): HTMLElement {
  const label = document.createElement('label');
  label.className = 'field';

  const caption = document.createElement('span');
  caption.className = 'field-label';
  caption.textContent = 'Правило';

  const select = document.createElement('select');
  select.id = 'rule-select';
  select.className = 'field-input';
  for (const option of RULE_OPTIONS) {
    const el = document.createElement('option');
    el.value = option.value;
    el.textContent = option.label;
    select.append(el);
  }
  select.value = value;
  select.addEventListener('change', () => onChange(select.value as Rule));

  label.append(caption, select);
  return label;
}
