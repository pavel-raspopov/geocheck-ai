/** Карточка вердикта v2: чеклист по правилам + общий итог (фича 11). */
import type { RulesEvaluation } from '../pipeline/rules/rules-engine';
import { formatRelation } from './relation-format';
import { formatEpsilon } from './types';
import { createVerdictBadge } from './verdict-badge';

export function createChecklistCard(): HTMLElement {
  const card = document.createElement('section');
  card.className = 'card verdict-card';
  const headline = document.createElement('h2');
  headline.className = 'headline';
  headline.textContent = 'Вердикт';
  const region = document.createElement('div');
  region.id = 'verdict-region';
  region.className = 'verdict-region';
  region.setAttribute('aria-live', 'polite');
  region.append(
    paragraph('verdict-empty', 'Подтвердите правила и нажмите «Подтвердить и проверить».'),
  );
  card.append(headline, region);
  return card;
}

/** Плейсхолдер между запусками (после загрузки нового файла, при анализе и т.п.). */
export function setChecklistPlaceholder(card: HTMLElement, text: string): void {
  card.querySelector('#verdict-region')?.replaceChildren(paragraph('verdict-empty', text));
}

/** Чеклист: строка на правило + общий вердикт, ε, софт-ноты, время анализа. */
export function updateChecklist(
  card: HTMLElement,
  evaluation: RulesEvaluation,
  notes: readonly string[] = [],
  timing?: string,
): void {
  const region = card.querySelector('#verdict-region');
  if (!region) return;
  const children: HTMLElement[] = [createVerdictBadge(evaluation.verdict)];
  for (const { relation, result } of evaluation.results) {
    const row = document.createElement('div');
    row.className = `check-row${result.status === 'Success' ? '' : ' check-row-fail'}`;
    const rule = document.createElement('span');
    rule.className = 'check-rule';
    rule.textContent = formatRelation(relation);
    const message = document.createElement('span');
    message.className = 'check-message';
    message.textContent = result.message;
    row.append(createVerdictBadge(result.status), rule, message);
    children.push(row);
  }
  const epsilon = evaluation.results[0]?.result.epsilon;
  if (epsilon !== undefined) {
    children.push(paragraph('verdict-meta', `ε = ${formatEpsilon(epsilon)}`));
  }
  if (timing) children.push(paragraph('verdict-timing mono', timing));
  if (notes.length > 0) {
    const wrap = document.createElement('div');
    wrap.className = 'verdict-notes';
    for (const note of notes) wrap.append(paragraph('verdict-note', note));
    children.push(wrap);
  }
  region.replaceChildren(...children);
}

function paragraph(className: string, text: string): HTMLParagraphElement {
  const el = document.createElement('p');
  el.className = className;
  el.textContent = text;
  return el;
}
