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

  // 9. Реальный пайплайн: рисуем чертёж в браузере. Линии светло-серые —
  // Otsu-бинаризация OCR отбрасывает их (Canny градиент ≈ 79 > CANNY_LOW,
  // сегменты детектируются), метки — чёрные Arial 32px: штрихи короче
  // MIN_SEGMENT_LENGTH не создают competing-вершин, центры глифов в 28 px
  // от вершин ≤ LABEL_RADIUS 40.
  const drawingPng = await page.evaluate(async () => {
    const c = document.createElement('canvas');
    c.width = 640;
    c.height = 300;
    const ctx = c.getContext('2d');
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, 640, 300);
    ctx.strokeStyle = '#b0b0b0';
    ctx.lineWidth = 4;
    ctx.lineCap = 'round';
    const seg = (x1, y1, x2, y2) => {
      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.lineTo(x2, y2);
      ctx.stroke();
    };
    seg(200, 60, 520, 60);
    seg(520, 60, 520, 220);
    ctx.fillStyle = '#000000';
    ctx.font = '700 32px Arial';
    ctx.fillText('A', 161, 71);
    ctx.fillText('B', 537, 71);
    ctx.fillText('C', 537, 231);
    const blob = await new Promise((r) => c.toBlob(r, 'image/png'));
    return Array.from(new Uint8Array(await blob.arrayBuffer()));
  });
  await page.evaluate((bytes) => {
    const file = new File([new Uint8Array(bytes)], 'drawing.png', { type: 'image/png' });
    const dt = new DataTransfer();
    dt.items.add(file);
    document
      .querySelector('.upload-zone')
      .dispatchEvent(new DragEvent('drop', { bubbles: true, cancelable: true, dataTransfer: dt }));
  }, drawingPng);
  await page.click('.btn-primary');
  await page.waitForFunction(() => document.querySelector('.badge')?.textContent === 'Верно', {
    timeout: 120000,
  });
  const realMsg = await page.$eval('.verdict-message', (el) => el.textContent);
  check('реальный пайплайн: ∠ABC = 90° → Success', realMsg.includes('Верно: угол ABC'));

  // 10. Смена правила после анализа — мгновенный verify() на сохранённом графе
  // (без повторного OCR): parallel требует точку D → контрактная мягкая ошибка.
  await page.select('#rule-select', 'parallel');
  await page.waitForFunction(() => document.querySelector('.badge')?.textContent === 'Ошибка', {
    timeout: 5000,
  });
  const parMsg = await page.$eval('.verdict-message', (el) => el.textContent);
  check(
    'после анализа: parallel → мягкая ошибка «Точка D не найдена» без повторного OCR',
    parMsg.includes('Точка D не найдена'),
  );

  // 11. Unhappy path: пустой чертёж → мягкая ошибка «не найдено отрезков».
  const blankPng = await page.evaluate(async () => {
    const c = document.createElement('canvas');
    c.width = 200;
    c.height = 200;
    const ctx = c.getContext('2d');
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, 200, 200);
    const blob = await new Promise((r) => c.toBlob(r, 'image/png'));
    return Array.from(new Uint8Array(await blob.arrayBuffer()));
  });
  await page.evaluate((bytes) => {
    const file = new File([new Uint8Array(bytes)], 'blank.png', { type: 'image/png' });
    const dt = new DataTransfer();
    dt.items.add(file);
    document
      .querySelector('.upload-zone')
      .dispatchEvent(new DragEvent('drop', { bubbles: true, cancelable: true, dataTransfer: dt }));
  }, blankPng);
  await page.click('.btn-primary');
  const blankMsg = await page.waitForFunction(
    () => document.querySelector('.verdict-message')?.textContent ?? null,
    { timeout: 120000 },
  );
  check(
    'пустой чертёж: мягкая ошибка «на чертеже не найдено отрезков»',
    blankMsg?.toString().includes('не найдено отрезков') ?? false,
  );

  // 12. Консоль: ожидаемый шум — 404 favicon (см. шапку файла).
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
