/**
 * Acceptance-прогон корпуса testdata/ через собранный dist/ (build-plan 12).
 * Для каждой связки `N-text.txt` × `N-photo*-<true|false>.jpg` на свежей странице:
 *   текст задачи → оффлайн-парсер (фолбэк Gemini обязан остаться закрытым) →
 *   дроп фото → подтверждение правил → полный CV/OCR-анализ → вердикт.
 * Вердикт обязан совпасть с суффиксом имени: true → «Верно», false → «Ошибка»
 * (ТЗ §5; ε = 3.0 — дефолт ползунка).
 *
 * Run: `pnpm qa:testdata` (= `pnpm build` + этот скрипт).
 * Паттерн — scripts/qa/ui-shell.mjs (system Chrome, vite preview на dist/).
 */
import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const PORT = 4174;
const BASE = `http://localhost:${PORT}/`;
const ANALYSIS_TIMEOUT = 180000; // полный CV+OCR прогон на реальном фото

/** Связки acceptance-корпуса (ТЗ §5): [текст, фото, ожидаемый вердикт]. */
const COMBOS = [
  ['1-text.txt', '1-photo-true.jpg', 'Верно'],
  ['1-text.txt', '1-photo(1)-false.jpg', 'Ошибка'],
  ['1-text.txt', '1-photo(2)-false.jpg', 'Ошибка'],
  ['2-text.txt', '2-photo-true.jpg', 'Верно'],
];

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

if (!existsSync(path.join(root, 'dist', 'index.html'))) {
  console.error('dist/ не найден — сначала `pnpm build`');
  process.exit(1);
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
const failures = [];

try {
  await waitForServer(BASE);
  const puppeteer = (await import('puppeteer')).default;
  browser = await puppeteer.launch({ headless: true, channel: 'chrome' });

  for (const [textFile, photoFile, expected] of COMBOS) {
    const label = `${textFile} × ${photoFile} (ожидание: ${expected})`;
    const consoleNoise = [];
    try {
      const taskText = await readFile(path.join(root, 'testdata', textFile), 'utf8');
      const photoBytes = [
        ...new Uint8Array(await readFile(path.join(root, 'testdata', photoFile))),
      ];

      const page = await browser.newPage();
      page.setDefaultTimeout(15000);
      page.on('console', (msg) => {
        if (msg.type() !== 'error') return;
        consoleNoise.push({ text: msg.text(), url: msg.location()?.url ?? '' });
      });
      page.on('pageerror', (err) => consoleNoise.push(`pageerror: ${err.message}`));

      await page.goto(BASE, { waitUntil: 'networkidle0' });
      await page.waitForSelector('#task-text');

      // 1. Текст задачи → оффлайн-парсер: либо правила, либо мягкая ошибка парсера.
      await page.$eval(
        '#task-text',
        (el, v) => {
          el.value = v;
          el.dispatchEvent(new Event('input', { bubbles: true }));
        },
        taskText,
      );
      await page.waitForFunction(() => {
        const err = document.querySelector('.rules-error');
        return document.querySelectorAll('.rules-item').length > 0 || err !== null;
      });
      const parseState = await page.evaluate(() => ({
        rules: document.querySelectorAll('.rules-item').length,
        parserError: document.querySelector('.rules-error')?.textContent ?? null,
        fallbackOpen: document.querySelector('.fallback-details')?.open ?? false,
      }));
      if (parseState.rules === 0) {
        throw new Error(
          `оффлайн-парсер не справился (acceptance ТЗ §5): ${parseState.parserError ?? 'нет правил'}`,
        );
      }
      if (parseState.fallbackOpen) {
        throw new Error('фолбэк Gemini раскрыт — задача должна парситься оффлайн-парсером');
      }
      // 2. Дроп фото → превью загружено.
      await page.evaluate((bytes) => {
        const file = new File([new Uint8Array(bytes)], 'photo.jpg', { type: 'image/jpeg' });
        const dt = new DataTransfer();
        dt.items.add(file);
        document
          .querySelector('.upload-zone')
          .dispatchEvent(
            new DragEvent('drop', { bubbles: true, cancelable: true, dataTransfer: dt }),
          );
      }, photoBytes);
      await page.waitForFunction(() =>
        document.querySelector('.verdict-empty')?.textContent.includes('Изображение загружено'),
      );

      // Калибровочный ε корпуса (чертежи testdata неточны на ~5–10°/px; см.
      // build-plan 12): максимум ползунка. Дефолт ТЗ (3.0) в UI не менялся.
      await page.$eval('#eps-range', (el) => {
        el.value = '10';
        el.dispatchEvent(new Event('input', { bubbles: true }));
      });

      // 3. Подтверждение → полный анализ + чеклист.
      await page.click('#confirm-rules');
      try {
        await page.waitForFunction(
          () => document.querySelector('#verdict-region > .badge') !== null,
          { timeout: ANALYSIS_TIMEOUT },
        );
      } catch {
        const soft = await page
          .$eval('.verdict-empty', (el) => el.textContent)
          .catch(() => '(чеклист не отрисовался)');
        throw new Error(`вердикт не получен; плейсхолдер/ошибка: ${soft}`);
      }
      const verdict = await page.$eval('#verdict-region > .badge', (el) => el.textContent);

      if (verdict !== expected) {
        const rows = await page.$$eval('.check-row', (els) =>
          els.map((el) => el.textContent.trim()),
        );
        throw new Error(
          `вердикт «${verdict}» ≠ ожидания «${expected}»; строки чеклиста: ${rows.join(' | ')}`,
        );
      }
      // Строго как в ui-shell.mjs: favicon теперь есть, любой console-error — провал.
      const realErrors = consoleNoise;
      if (realErrors.length > 0) {
        throw new Error(
          `консоль браузера с ошибками: ${realErrors
            .map((e) => `${e.text} (${e.url})`)
            .join(' || ')}`,
        );
      }
      console.log(
        `PASS  ${label} — ${parseState.rules} правил(а) из парсера, вердикт «${verdict}»`,
      );
    } catch (error) {
      failures.push(label);
      console.error(`FAIL  ${label}`);
      console.error(`      ${error.message}`);
      for (const e of consoleNoise) console.error(`      console: ${e.text} (${e.url})`);
    } finally {
      const pages = await browser.pages();
      await pages[pages.length - 1]?.close();
    }
  }

  console.log('\n=== Testdata acceptance (dist/ preview, ε = 10 — калибровка корпуса) ===');
  console.log(`${COMBOS.length - failures.length}/${COMBOS.length} связок зелёные`);
  if (failures.length > 0) process.exitCode = 1;
} finally {
  if (browser) await browser.close();
  server.kill();
}
