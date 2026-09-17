/** Одноразовый CORS-проба Gemini: невалидный ключ → смотрим статус ответа/консоль. */
import { spawn } from 'node:child_process';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const PORT = 4173;
const BASE = `http://localhost:${PORT}/`;

function waitForServer(url, timeoutMs = 20000) {
  const started = Date.now();
  return new Promise((resolve, reject) => {
    const retry = () => {
      if (Date.now() - started > timeoutMs) {
        reject(new Error(`сервер ${url} не поднялся`));
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
    'preview', '--port', String(PORT), '--strictPort',
  ],
  { cwd: root, stdio: 'ignore' },
);

try {
  console.log('PROBE: waiting for server');
  await waitForServer(BASE);
  console.log('PROBE: launching chrome');
  const puppeteer = (await import('puppeteer')).default;
  const browser = await puppeteer.launch({ headless: true, channel: 'chrome' });
  const page = await browser.newPage();
  const net = [];
  page.on('response', (res) => {
    if (res.url().includes('generativelanguage')) {
      net.push({ status: res.status(), ok: res.ok() });
    }
  });
  const consoleErrors = [];
  page.on('console', (msg) => {
    if (msg.type() === 'error') consoleErrors.push(msg.text());
  });
  console.log('PROBE: goto');
  await page.goto(BASE, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('#gemini-key', { timeout: 20000 });
  console.log('PROBE: typing key');
  await page.type('#gemini-key', 'test-invalid-key-probe');
  await page.click('#gemini-extract');
  console.log('PROBE: waiting for soft error');
  await page.waitForFunction(
    () => document.querySelector('.fallback-error')?.textContent.length > 0,
    { timeout: 60000, polling: 500 },
  );
  console.log('PROBE: done');
  const errText = await page.$eval('.fallback-error', (el) => el.textContent);
  console.log('SOFT_ERROR_SHOWN:', JSON.stringify(errText));
  console.log('GEMINI_RESPONSES:', JSON.stringify(net));
  console.log(
    'CORS:',
    net.length > 0
      ? 'response received — CORS enabled (browser reached the endpoint)'
      : 'no response observed (request blocked or failed before response)',
  );
  const corsErrors = consoleErrors.filter((t) => t.toLowerCase().includes('cors'));
  console.log('CONSOLE_CORS_ERRORS:', JSON.stringify(corsErrors));
  await browser.close();
} finally {
  server.kill();
}
