/** Скрытая секция фолбэка: поле Google API key + «Уточнить через ИИ» (фича 11).
 *  Ключ НЕ сохраняется (решение 2026-09-18): живёт только в поле — памяти вкладки —
 *  и исчезает при перезагрузке страницы. Никакого localStorage/.env/git. */

export interface GeminiFallbackHandle {
  readonly root: HTMLElement;
  setOpen(open: boolean): void;
  setError(message: string | null): void;
  setBusy(busy: boolean): void;
}

export function createGeminiFallback(onExtract: (apiKey: string) => void): GeminiFallbackHandle {
  const details = document.createElement('details');
  details.className = 'fallback-details';
  const summary = document.createElement('summary');
  summary.textContent = 'Уточнить через ИИ (Google Gemini)';
  const hint = document.createElement('p');
  hint.className = 'fallback-hint';
  hint.textContent =
    'Оффлайн-парсер не справился? Введите Google API key — он никуда не записывается: живёт только в памяти этой вкладки и пропадает после перезагрузки страницы. Запрос идёт по HTTPS напрямую к Gemini.';
  const field = document.createElement('label');
  field.className = 'field';
  const caption = document.createElement('span');
  caption.className = 'field-label';
  caption.textContent = 'Google API key';
  const key = document.createElement('input');
  key.id = 'gemini-key';
  key.className = 'field-input';
  key.type = 'password';
  key.autocomplete = 'off';
  const button = document.createElement('button');
  button.type = 'button';
  button.id = 'gemini-extract';
  button.className = 'btn-primary';
  button.textContent = 'Уточнить через ИИ';
  const error = document.createElement('p');
  error.className = 'fallback-error';

  field.append(caption, key);
  details.append(summary, hint, field, button, error);

  button.addEventListener('click', () => {
    if (key.value.trim().length > 0) onExtract(key.value.trim());
  });

  return {
    root: details,
    setOpen: (open) => {
      details.open = open;
    },
    setError: (message) => {
      error.textContent = message ?? '';
    },
    setBusy: (busy) => {
      button.disabled = busy;
      button.textContent = busy ? 'Запрос…' : 'Уточнить через ИИ';
    },
  };
}
