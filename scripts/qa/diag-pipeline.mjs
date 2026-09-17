/**
 * Диагностика пайплайна на картинке testdata (одноразовый инструмент калибровки, шаг 12).
 * Поднимает `vite` dev-server, в headless Chrome исполняет реальные стадии
 * (detectSegments → dedup → tesseract (все кандидаты!) → buildGraph) и печатает:
 *   - сегменты после дедупликации;
 *   - ВСЕ OCR-кандидаты (текст, conf, центр bbox) — до фильтра extractLabels;
 *   - вершины графа, привязанные метки, расстояния метка→ближайшая вершина.
 * Страничная часть — scripts/qa/diag-runner.js (vite переписывает bare-импорты).
 *
 * Run: `node scripts/qa/diag-pipeline.mjs testdata/1-photo-true.jpg`
 */
import { spawn } from 'node:child_process';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const PORT = 5174;
const BASE = `http://localhost:${PORT}/`;
const mode = ['--full', '--refine'].includes(process.argv[2]) ? process.argv[2] : '';
const imageArg = mode ? (process.argv[3] ?? 'testdata/1-photo-true.jpg') : process.argv[2];

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
    '--port',
    String(PORT),
    '--strictPort',
  ],
  { cwd: root, stdio: 'ignore' },
);

let browser = null;
try {
  await waitForServer(BASE);
  const puppeteer = (await import('puppeteer')).default;
  browser = await puppeteer.launch({ headless: true, channel: 'chrome' });
  const page = await browser.newPage();
  page.setDefaultTimeout(120000);
  await page.goto(BASE, { waitUntil: 'networkidle0' });

  const report = await page.evaluate(
    async (imagePath, mode) => {
      const runner = await import('/scripts/qa/diag-runner.js');
      if (mode === '--full') return runner.runFullDiagnostic(imagePath);
      if (mode === '--refine') return runner.runRefineProbe(imagePath);
      return runner.runDiagnostic(imagePath);
    },
    imageArg,
    mode,
  );

  for (const crop of report.crops ?? []) {
    const out = path.join(root, `diag-crop-${crop.name}.png`);
    await import('node:fs/promises').then((fs) =>
      fs.writeFile(out, Buffer.from(crop.url.split(',')[1], 'base64')),
    );
    console.log(`crop: ${out}`);
  }
  console.log(JSON.stringify({ ...report, crops: undefined }, null, 2));
} finally {
  if (browser) await browser.close();
  server.kill();
}
