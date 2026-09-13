import type { Label, LineSegment, Vertex } from '../pipeline/types';
import type { DemoDrawing } from '../mock/demo-drawings';

/** Логические размеры демо-пространства (координаты сцен из demo-drawings). */
const DEMO_WIDTH = 800;
const DEMO_HEIGHT = 600;

/** Цвет только из дизайн-токенов: canvas не имеет разметки — читаем CSS-переменные. */
function cssVar(name: string): string {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
}

export interface CanvasOverlay {
  readonly segments: readonly LineSegment[];
  readonly vertices: readonly Vertex[];
  readonly labels: readonly Label[];
}

/** Оверлей распознанного: сегменты accent, вершины ink-3, метки info. */
function drawOverlay(
  ctx: CanvasRenderingContext2D,
  overlay: CanvasOverlay,
  scale: number,
  offsetX: number,
  offsetY: number,
): void {
  ctx.save();
  ctx.translate(offsetX, offsetY);
  ctx.scale(scale, scale);
  ctx.strokeStyle = cssVar('--color-accent');
  ctx.lineWidth = 2 / scale;
  ctx.lineCap = 'round';
  for (const s of overlay.segments) {
    ctx.beginPath();
    ctx.moveTo(s.x1, s.y1);
    ctx.lineTo(s.x2, s.y2);
    ctx.stroke();
  }
  ctx.fillStyle = cssVar('--color-ink-3');
  const r = 4 / scale;
  for (const v of overlay.vertices) {
    ctx.beginPath();
    ctx.arc(v.x, v.y, r, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.fillStyle = cssVar('--color-info');
  ctx.font = '600 16px "JetBrains Mono", ui-monospace, monospace';
  ctx.textAlign = 'center';
  for (const l of overlay.labels) {
    ctx.fillText(l.char, l.cx, l.cy - 18 / scale);
  }
  ctx.restore();
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
    'Загрузите чертёж и нажмите «Проверить»: поверх изображения показываются распознанные отрезки, вершины и метки.';

  card.append(headline, uploadZone, well, note);
  return { card, canvas };
}

/** Перерисовка холста: превью изображения (с оверлеем) либо демо-чертёж. */
export function renderCanvas(
  canvas: HTMLCanvasElement,
  drawing: DemoDrawing,
  imageUrl: string | null,
  overlay?: CanvasOverlay | null,
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
    img.addEventListener('load', () => {
      const iw = img.naturalWidth || img.width;
      const ih = img.naturalHeight || img.height;
      // Вписываем изображение целиком (contain-fit); оверлей — через ту же трансформацию.
      const scale = Math.min(width / iw, height / ih);
      const offsetX = (width - iw * scale) / 2;
      const offsetY = (height - ih * scale) / 2;
      ctx.drawImage(img, offsetX, offsetY, iw * scale, ih * scale);
      if (overlay) {
        drawOverlay(ctx, overlay, scale, offsetX, offsetY);
      }
    });
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

  const overlay: CanvasOverlay = {
    segments: drawing.segments,
    vertices: Object.values(drawing.graph),
    labels: drawing.labels,
  };
  drawOverlay(ctx, overlay, scale, offsetX, offsetY);
}
