/** Зона загрузки: drag-and-drop + скрытый файловый инпут, клавиатурный доступ. */
export function createUploadZone(onFile: (file: File) => void): HTMLElement {
  const zone = document.createElement('div');
  zone.className = 'upload-zone';
  zone.setAttribute('role', 'button');
  zone.tabIndex = 0;
  zone.setAttribute(
    'aria-label',
    'Загрузить изображение чертежа: перетащите файл или нажмите для выбора',
  );

  const input = document.createElement('input');
  input.type = 'file';
  input.accept = 'image/*';
  input.className = 'upload-input';
  input.addEventListener('change', () => {
    const file = input.files?.item(0);
    if (file) {
      dispatch(file);
    }
    input.value = '';
  });

  const title = document.createElement('p');
  title.className = 'upload-title';
  title.textContent = 'Перетащите файл или нажмите для выбора';

  const hint = document.createElement('p');
  hint.className = 'upload-hint';
  hint.textContent = 'PNG, JPEG, WEBP — изображения больше 1600 px сжимаются автоматически';

  const error = document.createElement('p');
  error.className = 'upload-error';
  error.hidden = true;

  function showError(message: string): void {
    error.textContent = message;
    error.hidden = false;
  }

  function dispatch(file: File): void {
    if (file.type.startsWith('image/')) {
      error.hidden = true;
      onFile(file);
    } else {
      showError('Файл не является изображением');
    }
  }

  zone.addEventListener('click', () => input.click());
  zone.addEventListener('keydown', (event) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      input.click();
    }
  });
  zone.addEventListener('dragenter', (event) => {
    event.preventDefault();
    zone.classList.add('is-drag');
  });
  zone.addEventListener('dragover', (event) => event.preventDefault());
  zone.addEventListener('dragleave', () => zone.classList.remove('is-drag'));
  zone.addEventListener('drop', (event) => {
    event.preventDefault();
    zone.classList.remove('is-drag');
    const file = event.dataTransfer?.files.item(0);
    if (file) {
      dispatch(file);
    }
  });

  zone.append(input, title, hint, error);
  return zone;
}
