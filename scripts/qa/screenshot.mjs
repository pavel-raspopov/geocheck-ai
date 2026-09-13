/**
 * Captures `docs/screenshot.png` (README) from the built `dist/` in demo mode.
 * Run: `pnpm build && node scripts/qa/screenshot.mjs` (or `pnpm shot`).
 * Same harness setup as ui-shell.mjs: `vite preview` + system Chrome
 * (puppeteer `channel: 'chrome'`, no bundled Chromium).
 */
import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const PORT = 4174;
const BASE = `http://localhost:${PORT}/`;

if (!existsSync(path.join(root, 'dist', 'index.html'))) {
  console.error('dist/ не найден — сначала `pnpm build`');
  process.exit(1);
}

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

try {
  await waitForServer(BASE);
  const puppeteer = (await import('puppeteer')).default;
  const browser = await puppeteer.launch({ headless: true, channel: 'chrome' });
  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 860, deviceScaleFactor: 2 });
  await page.goto(BASE, { waitUntil: 'networkidle0' });
  await page.waitForSelector('.badge', { timeout: 15000 });
  await new Promise((r) => setTimeout(r, 500));
  await page.screenshot({ path: path.join(root, 'docs', 'screenshot.png') });
  console.log('OK: docs/screenshot.png');
  await browser.close();
} finally {
  server.kill();
}
