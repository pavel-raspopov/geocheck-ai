/** Предпросмотр распознанных правил + подтверждение (human-in-the-loop шлюз, фича 11). */
import type { ParsedTask } from '../pipeline/rules/types';
import { formatTaskSummary } from './relation-format';

export interface RulesPreviewHandle {
  readonly root: HTMLElement;
  /** task=null → показ ошибки разбора; кнопка подтверждения неактивна. */
  render(task: ParsedTask | null, error: string | null): void;
}

export function createRulesPreview(onConfirm: () => void): RulesPreviewHandle {
  const root = document.createElement('div');
  root.className = 'rules-preview';
  const caption = document.createElement('span');
  caption.className = 'field-label';
  caption.textContent = 'Распознанные правила';
  const list = document.createElement('ul');
  list.className = 'rules-list';
  const givens = document.createElement('p');
  givens.className = 'rules-givens';
  const source = document.createElement('p');
  source.className = 'rules-source';
  const error = document.createElement('p');
  error.className = 'rules-error';
  const confirm = document.createElement('button');
  confirm.type = 'button';
  confirm.id = 'confirm-rules';
  confirm.className = 'btn-primary';
  confirm.textContent = 'Подтвердить и проверить';
  confirm.addEventListener('click', onConfirm);
  root.append(caption, list, givens, source, error, confirm);

  return {
    root,
    render(task, errorText) {
      const summary = task !== null ? formatTaskSummary(task) : { rules: [], givens: [] };
      list.replaceChildren(
        ...summary.rules.map((rule) => {
          const li = document.createElement('li');
          li.className = 'rules-item';
          li.textContent = rule;
          return li;
        }),
      );
      givens.textContent = summary.givens.length > 0 ? `Дано: ${summary.givens.join('; ')}` : '';
      source.textContent =
        task === null
          ? ''
          : task.source === 'gemini'
            ? 'Источник: Gemini'
            : 'Источник: оффлайн-парсер';
      const noRules = task !== null && task.relations.length === 0;
      // Пустой список правил (например, Gemini вернул ok с relations: []) —
      // НЕ повод для зелёного вердикта: подтверждение блокируется с подсказкой
      // (ревью Phase 6, 2026-09-18; движок остаётся нейтральным — Success на []).
      error.textContent =
        errorText ??
        (noRules ? 'Правила не распознаны — отредактируйте текст или уточните через ИИ ниже' : '');
      confirm.disabled = task === null || noRules;
    },
  };
}
