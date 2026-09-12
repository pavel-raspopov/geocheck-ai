import type { DemoDrawing } from '../mock/demo-drawings';

/** Логические размеры демо-пространства (координаты сцен из demo-drawings). */
const DEMO_WIDTH = 800;
const DEMO_HEIGHT = 600;

/** Цвет только из дизайн-токенов: canvas не имеет разметки — читаем CSS-переменные. */
function cssVar(name: string): string {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
}

export interface CanvasCard {
  readonly card: HTMLElement;
  readonly canvas: HTMLCanvasElement;
}

/** Карточка холста: зона загрузки сверху, «шахматное» поле с чертежом ниже. */
export function createCanvasCard(uploadZone: HTMLElement): CanvasCard {
  const card = document.createElement('section');
  card.className = 'card canvas-card';

  const headline = document.createElement('h2');
  headline.className = 'headline';
  headline.textContent = 'Чертёж';

  const well = document.createElement('div');
  well.className = 'canvas-checker';
  const canvas = document.createElement('canvas');
  canvas.id = 'drawing-canvas';
  well.append(canvas);

  const note = document.createElement('p');
  note.className = 'canvas-note';
  note.textContent =
    'Демо-режим: анализ загруженного изображения появится после подключения пайплайна (Фазы 2–4).';

  card.append(headline, uploadZone, well, note);
  return { card, canvas };
}

/** Перерисовка холста: превью изображения (если есть) либо демо-чертёж с оверлеем. */
export function renderCanvas(
  canvas: HTMLCanvasElement,
  drawing: DemoDrawing,
  imageUrl: string | null,
): void {
  const dpr = typeof window.devicePixelRatio === 'number' ? window.devicePixelRatio : 1;
  const width = Math.max(1, canvas.clientWidth);
  const height = Math.max(1, canvas.clientHeight);
  canvas.width = Math.round(width * dpr);
  canvas.height = Math.round(height * dpr);

  const ctx = canvas.getContext('2d');
  if (!ctx) {
    return;
  }
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, width, height);

  if (imageUrl) {
    const img = document.createElement('img');
    img.addEventListener('load', () => ctx.drawImage(img, 0, 0, width, height));
    img.src = imageUrl;
    return;
  }
  drawDemo(ctx, drawing, width, height);
}

function drawDemo(
  ctx: CanvasRenderingContext2D,
  drawing: DemoDrawing,
  width: number,
  height: number,
): void {
  // Вписываем логические 800×600 в фактический размер холста.
  const scale = Math.min(width / DEMO_WIDTH, height / DEMO_HEIGHT);
  const offsetX = (width - DEMO_WIDTH * scale) / 2;
  const offsetY = (height - DEMO_HEIGHT * scale) / 2;

  ctx.save();
  ctx.translate(offsetX, offsetY);
  ctx.scale(scale, scale);

  // Сегменты — акцент.
  ctx.strokeStyle = cssVar('--color-accent');
  ctx.lineWidth = 2;
  ctx.lineCap = 'round';
  for (const s of drawing.segments) {
    ctx.beginPath();
    ctx.moveTo(s.x1, s.y1);
    ctx.lineTo(s.x2, s.y2);
    ctx.stroke();
  }

  // Вершины — точки ink-3.
  ctx.fillStyle = cssVar('--color-ink-3');
  for (const v of Object.values(drawing.graph)) {
    ctx.beginPath();
    ctx.arc(v.x, v.y, 4, 0, Math.PI * 2);
    ctx.fill();
  }

  // Метки букв — info, моноширинно.
  ctx.fillStyle = cssVar('--color-info');
  ctx.font = '600 16px "JetBrains Mono", ui-monospace, monospace';
  ctx.textAlign = 'center';
  for (const l of drawing.labels) {
    ctx.fillText(l.char, l.cx, l.cy - 18);
  }

  ctx.restore();
}
