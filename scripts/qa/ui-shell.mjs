/**
 * Headless live-verification of the Phase-1 UI shell (build-plan 01).
 * Serves `dist/` via `vite preview` and drives the system Chrome
 * (puppeteer `channel: 'chrome'` — no bundled Chromium download; its
 * postinstall build script is intentionally left unapproved).
 *
 * Run: `pnpm qa` (= `pnpm build` + this script).
 * Gotchas inherited from the cost-guard-ai QA harness:
 *   - `waitForFunction`/`evaluate` callbacks must be self-contained
 *     (closures over Node scope do NOT cross into the page);
 *   - Chrome logs some expected network noise (favicon 404) as console
 *     errors — filtered explicitly below.
 */
import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const PORT = 4173;
const BASE = `http://localhost:${PORT}/`;

if (!existsSync(path.join(root, 'dist', 'index.html'))) {
  console.error('dist/ не найден — сначала `pnpm build`');
  process.exit(1);
}

const FAIL_TEXT = 'Ошибка: Угол ABC на рисунке равен 84.12°, отклонение составляет 5.88°';

function waitForServer(url, timeoutMs = 20000) {
  const started = Date.now();
  return new Promise((resolve, reject) => {
    const retry = () => {
      if (Date.now() - started > timeoutMs) {
        reject(new Error(`сервер ${url} не поднялся за ${timeoutMs} мс`));
        return;
      }
      setTimeout(poll, 250);
    };
    const poll = () => {
      const req = http.get(url, (res) => {
        res.resume();
        if (res.statusCode === 200) resolve();
        else retry();
      });
      req.on('error', retry);
    };
    poll();
  });
}

const server = spawn(
  process.execPath,
  [
    path.join(root, 'node_modules', 'vite', 'bin', 'vite.js'),
    'preview',
    '--port',
    String(PORT),
    '--strictPort',
  ],
  { cwd: root, stdio: 'ignore' },
);

let browser = null;
let failed = 0;

try {
  await waitForServer(BASE);

  const puppeteer = (await import('puppeteer')).default;
  browser = await puppeteer.launch({ headless: true, channel: 'chrome' });
  const page = await browser.newPage();
  page.setDefaultTimeout(10000);

  const consoleNoise = [];
  page.on('console', (msg) => {
    if (msg.type() !== 'error') return;
    consoleNoise.push({ text: msg.text(), url: msg.location()?.url ?? '' });
  });
  page.on('pageerror', (err) => consoleNoise.push({ text: `pageerror: ${err.message}`, url: '' }));

  const results = [];
  const check = (name, ok) => {
    results.push([name, Boolean(ok)]);
    if (!ok) failed++;
  };

  await page.goto(BASE, { waitUntil: 'networkidle0' });

  // Диагностика при сбое рендера: печатаем, что реально в #app и в консоли.
  try {
    await page.waitForSelector('.title', { timeout: 5000 });
  } catch {
    const app = await page
      .$eval('#app', (el) => el.innerHTML.slice(0, 500))
      .catch(() => '(#app нет)');
    console.error('ДИАГНОСТИКА: #app =', app);
    for (const e of consoleNoise) console.error('ДИАГНОСТИКА console:', e.text, e.url);
    throw new Error('приложение не отрисовалось в браузере');
  }

  // 1. Оболочка отрисовалась.
  check(
    'топбар: заголовок «GeoCheck AI»',
    (await page.$eval('.title', (el) => el.textContent)) === 'GeoCheck AI',
  );

  // 2. Вердикт авто-запуска: идеальная сцена + perpendicular → Success.
  await page.waitForSelector('.badge');
  check(
    'авто-вердикт: «Верно» (Success)',
    (await page.$eval('.badge', (el) => el.textContent)) === 'Верно',
  );

  // 3. Демо-чертёж реально нарисован на холсте.
  const hasInk = await page.$eval('#drawing-canvas', (canvas) => {
    const data = canvas.getContext('2d').getImageData(0, 0, canvas.width, canvas.height).data;
    for (let i = 3; i < data.length; i += 4) {
      if (data[i] !== 0) return true;
    }
    return false;
  });
  check('холст: демо-чертёж нарисован', hasInk);

  // 4. Смена правила → сообщение о параллельности.
  await page.select('#rule-select', 'parallel');
  await page.waitForFunction(() =>
    document.querySelector('.verdict-message')?.textContent.includes('параллельны'),
  );
  check(
    'правило parallel: Success с сообщением о параллельности',
    (await page.$eval('.badge', (el) => el.textContent)) === 'Верно',
  );

  // 5. Сцена с отклонениями + perpendicular при ε = 3 → точный текст ТЗ.
  await page.select('#scenario-select', 'tilted');
  await page.select('#rule-select', 'perpendicular');
  await page.$eval('#eps-range', (el) => {
    el.value = '3';
    el.dispatchEvent(new Event('input', { bubbles: true }));
  });
  await page.waitForFunction(
    (expected) => {
      return document.querySelector('.verdict-message')?.textContent === expected;
    },
    {},
    FAIL_TEXT,
  );
  check('отклонения, ε = 3: Fail с точным текстом ТЗ (84.12°/5.88°)', true);

  // 6. Ползунок ε → 6: тот же чертёж становится Success (ε управляет движком).
  await page.$eval('#eps-range', (el) => {
    el.value = '6';
    el.dispatchEvent(new Event('input', { bubbles: true }));
  });
  await page.waitForFunction(() => document.querySelector('.badge')?.textContent === 'Верно');
  check('ползунок ε = 6 на «отклонениях»: Success', true);

  // 7. Кнопка «Проверить» перезапускает вердикт.
  await page.click('.btn-primary');
  check('кнопка «Проверить»: вердикт на месте', (await page.$('.badge')) !== null);

  // 8. Unhappy path: сброс не-изображения → мягкая ошибка в зоне загрузки.
  await page.evaluate(() => {
    const zone = document.querySelector('.upload-zone');
    const dt = new DataTransfer();
    dt.items.add(new File(['x'], 'notes.txt', { type: 'text/plain' }));
    zone.dispatchEvent(
      new DragEvent('drop', { bubbles: true, cancelable: true, dataTransfer: dt }),
    );
  });
  const uploadError = await page.waitForFunction(
    () => {
      const el = document.querySelector('.upload-error');
      return el && !el.hidden ? el.textContent : null;
    },
    { polling: 200 },
  );
  check(
    'не-изображение: мягкая ошибка «Файл не является изображением»',
    uploadError?.toString().includes('не является изображением') ?? false,
  );

  // 9. Консоль: ожидаемый шум — 404 favicon (см. шапку файла).
  const realErrors = consoleNoise.filter(
    (e) => !(e.url.includes('favicon') && e.text.includes('404')),
  );
  check('консоль без ошибок', realErrors.length === 0);
  for (const e of realErrors) {
    console.log(`  console: ${e.text} (${e.url})`);
  }

  console.log('\n=== Live QA (headless Chrome, dist/ preview) ===');
  for (const [name, ok] of results) {
    console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}`);
  }
  const passed = results.length - failed;
  console.log(`\n${passed}/${results.length} assertions pass`);
  if (failed > 0) process.exitCode = 1;
} finally {
  if (browser) await browser.close();
  server.kill();
}
