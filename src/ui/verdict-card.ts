import type { VerifyResult } from '../pipeline/types';
import { formatEpsilon } from './types';
import { createVerdictBadge } from './verdict-badge';

/** Карточка вердикта: заголовок + aria-live область с бейджем, сообщением и ε. */
export function createVerdictCard(): HTMLElement {
  const card = document.createElement('section');
  card.className = 'card verdict-card';

  const headline = document.createElement('h2');
  headline.className = 'headline';
  headline.textContent = 'Вердикт';

  const region = document.createElement('div');
  region.id = 'verdict-region';
  region.className = 'verdict-region';
  region.setAttribute('aria-live', 'polite');
  const placeholder = document.createElement('p');
  placeholder.className = 'verdict-empty';
  placeholder.textContent = 'Выберите правило и нажмите «Проверить».';
  region.append(placeholder);

  card.append(headline, region);
  return card;
}

/** Обновление карточки вердикта (скринридер: aria-live); notes — софт-ноты. */
export function updateVerdictCard(
  card: HTMLElement,
  verdict: VerifyResult,
  notes: readonly string[] = [],
): void {
  const region = card.querySelector('#verdict-region');
  if (!region) {
    return;
  }
  const badge = createVerdictBadge(verdict.status);
  const message = paragraph('verdict-message', verdict.message);
  const meta = paragraph('verdict-meta', `ε = ${formatEpsilon(verdict.epsilon)}`);
  const children: HTMLElement[] = [badge, message, meta];
  if (notes.length > 0) {
    const wrap = document.createElement('div');
    wrap.className = 'verdict-notes';
    for (const note of notes) {
      const el = document.createElement('p');
      el.className = 'verdict-note';
      el.textContent = note;
      wrap.append(el);
    }
    children.push(wrap);
  }
  region.replaceChildren(...children);
}

/** Плейсхолдер между запусками (например, после загрузки нового файла). */
export function setVerdictPlaceholder(card: HTMLElement, text: string): void {
  const region = card.querySelector('#verdict-region');
  if (!region) {
    return;
  }
  region.replaceChildren(paragraph('verdict-empty', text));
}

function paragraph(className: string, text: string): HTMLParagraphElement {
  const el = document.createElement('p');
  el.className = className;
  el.textContent = text;
  return el;
}
