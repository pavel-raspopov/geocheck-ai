import './styles.css';

/**
 * Точка входа SPA. Фаза 0: только скелет — полноценный интерфейс
 * (загрузка, правила, слайдер ε, холст) появляется на Фазе 1 (build-plan).
 */
const app = document.getElementById('app');
if (!app) {
  throw new Error('Элемент #app не найден');
}

app.innerHTML = `
  <header class="topbar">
    <h1 class="title">GeoCheck AI</h1>
    <p class="subtitle">Модуль верификации геометрических чертежей</p>
  </header>
  <section class="card phase-note">
    <h2 class="headline">Скелет проекта готов (Фаза 0)</h2>
    <p class="body">
      Интерфейс появится на Фазе 1: drag-and-drop загрузка, выбор правила,
      слайдер погрешности ε и холст с вердиктом. Пайплайн уже покрыт тестами:
      <code class="mono">pnpm test</code> ·
      <code class="mono">pnpm typecheck</code> ·
      <code class="mono">pnpm build</code>.
    </p>
  </section>
`;
