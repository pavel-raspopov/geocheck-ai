/** Многострочное поле текста задачи (фича 11, замена rule-select). */
export function createTaskText(value: string, onInput: (text: string) => void): HTMLLabelElement {
  const label = document.createElement('label');
  label.className = 'field';
  const caption = document.createElement('span');
  caption.className = 'field-label';
  caption.textContent = 'Текст задачи';
  const textarea = document.createElement('textarea');
  textarea.id = 'task-text';
  textarea.className = 'field-input task-text-input';
  textarea.rows = 4;
  textarea.spellcheck = false;
  textarea.placeholder =
    'Например: В треугольнике ABC проведены биссектриса BM и медиана BK. Известно, что AC = 16 см, ∠ABC = 100°.';
  textarea.value = value;
  textarea.addEventListener('input', () => onInput(textarea.value));
  label.append(caption, textarea);
  return label;
}
