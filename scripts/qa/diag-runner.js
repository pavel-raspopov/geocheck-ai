/** Страничная часть диагностики (исполняется в браузере через vite dev). */

/** Подготовка варианта изображения для OCR: белые поля + апскейл (smoothing переключаем). */
function prepImage(raw, pad, scale, smooth) {
  const tmp = document.createElement('canvas');
  tmp.width = raw.width;
  tmp.height = raw.height;
  tmp
    .getContext('2d')
    .putImageData(new ImageData(new Uint8ClampedArray(raw.data), raw.width, raw.height), 0, 0);
  const c = document.createElement('canvas');
  c.width = Math.round(raw.width * scale) + pad * 2;
  c.height = Math.round(raw.height * scale) + pad * 2;
  const ctx = c.getContext('2d', { willReadFrequently: true });
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, c.width, c.height);
  ctx.imageSmoothingEnabled = smooth;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(tmp, pad, pad, Math.round(raw.width * scale), Math.round(raw.height * scale));
  const id = ctx.getImageData(0, 0, c.width, c.height);
  return { width: c.width, height: c.height, data: id.data };
}

/** Зонд refine-прохода: что recognizeChar возвращает на целях пайплайна. */
export async function runRefineProbe(imagePath) {
  const { detectSegments } = await import('/src/pipeline/lines.ts');
  const { deduplicateSegments } = await import('/src/pipeline/dedup.ts');
  const { recognizeLabels, recognizeChar } = await import('/src/pipeline/ocr.ts');
  const { buildGraph } = await import('/src/pipeline/graph.ts');
  const { refineTargets, maskSegments, cropUpscale } = await import('/src/pipeline/ocr-refine.ts');
  const { fileToRawImage } = await import('/src/ui/image-input.ts');
  const { OCR_REFINE_SKIP_RADIUS } = await import('/src/pipeline/constants.ts');

  const bytes = await fetch(imagePath).then((r) => r.arrayBuffer());
  const file = new File([bytes], 'diag.jpg', { type: 'image/jpeg' });
  const { raw } = await fileToRawImage(file);
  const segments = deduplicateSegments(await detectSegments(raw));
  const labels = await recognizeLabels(raw);
  const graphResult = buildGraph(segments, labels);
  const targets = refineTargets(graphResult.vertices, graphResult.graph, OCR_REFINE_SKIP_RADIUS);

  const probes = [];
  const centroidOf = (img) => {
    let sx = 0;
    let sy = 0;
    let n = 0;
    for (let y = 0; y < img.height; y++) {
      for (let x = 0; x < img.width; x++) {
        const o = (y * img.width + x) * 4;
        if (img.data[o] < 128) {
          sx += x;
          sy += y;
          n++;
        }
      }
    }
    return n === 0 ? null : { x: sx / n, y: sy / n, n };
  };
  for (const t of targets) {
    const cx = Math.round(t.x);
    const cy = Math.round(t.y);
    // Стратегия «центроид глифа»: тяжёлая маска → центроид чернил в окне
    // локализации → кроп от оригинала с центром на глифе → PSM 10.
    const locR = 24;
    const localized = cropUpscale(maskSegments(raw, segments, 11), cx, cy, locR, 1);
    const c = centroidOf(localized);
    const probe = {
      at: [cx, cy],
      centroid: c ? [Math.round(c.x + cx - locR), Math.round(c.y + cy - locR), c.n] : null,
      top: [],
    };
    if (c) {
      const gx = Math.round(c.x + cx - locR);
      const gy = Math.round(c.y + cy - locR);
      const readFrom = maskSegments(raw, segments, 3);
      for (const radius of [14, 18]) {
        const crop = cropUpscale(readFrom, gx, gy, radius, OCR_REFINE_UPSCALE);
        const candidates = await recognizeChar(crop);
        probe.top.push({
          radius,
          candidates: candidates
            .slice()
            .sort((a, b) => b.confidence - a.confidence)
            .slice(0, 3)
            .map((c2) => `${c2.char}:${Math.round(c2.confidence)}`),
        });
      }
    }
    probes.push(probe);
  }
  return { targets: targets.map((t) => [Math.round(t.x), Math.round(t.y)]), probes };
}

export async function runFullDiagnostic(imagePath) {
  const { analyzeImage } = await import('/src/pipeline/run.ts');
  const { fileToRawImage } = await import('/src/ui/image-input.ts');
  const bytes = await fetch(imagePath).then((r) => r.arrayBuffer());
  const file = new File([bytes], 'diag.jpg', { type: 'image/jpeg' });
  const { raw } = await fileToRawImage(file);
  const result = await analyzeImage(raw);
  return {
    imageSize: [raw.width, raw.height],
    segments: result.segments.length,
    labels: result.labels.map((l) => ({
      char: l.char,
      at: [Math.round(l.cx), Math.round(l.cy)],
    })),
    graphKeys: Object.keys(result.graph),
    unbound: result.unboundLabels.map((l) => l.char),
    timings: result.timings,
  };
}

export async function runDiagnostic(imagePath) {
  const { detectSegments } = await import('/src/pipeline/lines.ts');
  const { deduplicateSegments } = await import('/src/pipeline/dedup.ts');
  const { encodeBmp } = await import('/src/pipeline/ocr.ts');
  const { fileToRawImage } = await import('/src/ui/image-input.ts');
  const { OCR_CHAR_WHITELIST, OCR_LANG, OCR_MIN_CONFIDENCE, OCR_PSM, OCR_USER_DPI, LABEL_RADIUS } =
    await import('/src/pipeline/constants.ts');

  const bytes = await fetch(imagePath).then((r) => r.arrayBuffer());
  const file = new File([bytes], 'diag.jpg', { type: 'image/jpeg' });
  const { raw } = await fileToRawImage(file);

  // Исходное изображение на canvas — источник для prepImage и кропов.
  const tmp = document.createElement('canvas');
  tmp.width = raw.width;
  tmp.height = raw.height;
  tmp
    .getContext('2d')
    .putImageData(new ImageData(new Uint8ClampedArray(raw.data), raw.width, raw.height), 0, 0);

  // Стадии 1–2: детекция + дедупликация.
  const segments = deduplicateSegments(await detectSegments(raw));

  // Стадия 3: OCR-варианты (поля + апскейл) с сырым деревом — все кандидаты.
  const tesseract = await import('tesseract.js');
  const worker = await tesseract.createWorker(OCR_LANG, undefined, {
    langPath: '/tessdata',
    workerPath: '/tesseract/worker.min.js',
    corePath: '/tesseract',
    cacheMethod: 'none',
    gzip: true,
    logger: () => {},
  });
  await worker.setParameters({
    tessedit_pageseg_mode: OCR_PSM,
    tessedit_char_whitelist: OCR_CHAR_WHITELIST,
    user_defined_dpi: OCR_USER_DPI,
  });

  const results = [];
  function maskLines(width, buttCaps) {
    const m = document.createElement('canvas');
    m.width = raw.width;
    m.height = raw.height;
    const mctx = m.getContext('2d', { willReadFrequently: true });
    mctx.putImageData(new ImageData(new Uint8ClampedArray(raw.data), raw.width, raw.height), 0, 0);
    mctx.strokeStyle = '#ffffff';
    mctx.lineCap = buttCaps ? 'butt' : 'round';
    mctx.lineWidth = width;
    for (const s of segments) {
      mctx.beginPath();
      mctx.moveTo(s.x1, s.y1);
      mctx.lineTo(s.x2, s.y2);
      mctx.stroke();
    }
    const mid = mctx.getImageData(0, 0, raw.width, raw.height);
    return { canvas: m, image: { width: raw.width, height: raw.height, data: mid.data } };
  }

  const cases = [
    { name: 'mask3butt-x3', maskWidth: 3, buttCaps: true, scale: 3, psm: OCR_PSM },
    { name: 'mask4butt-x3', maskWidth: 4, buttCaps: true, scale: 3, psm: OCR_PSM },
    { name: 'mask3butt-x4', maskWidth: 3, buttCaps: true, scale: 4, psm: OCR_PSM },
  ];
  for (const spec of cases) {
    const name = spec.name;
    const scale = spec.scale;
    const pad = 32;
    const source = maskLines(spec.maskWidth, spec.buttCaps).image;
    const prepared = prepImage(source, pad, scale, false);
    await worker.setParameters({ tessedit_pageseg_mode: spec.psm });
    const { data } = await worker.recognize(encodeBmp(prepared), undefined, {
      blocks: true,
      text: false,
    });
    const candidates = [];
    for (const block of data.blocks ?? []) {
      for (const paragraph of block.paragraphs) {
        for (const line of paragraph.lines) {
          for (const word of line.words) {
            const symbols = word.symbols?.length ? word.symbols : [word];
            for (const s of symbols) {
              candidates.push({
                text: s.text.trim(),
                conf: Math.round(s.confidence),
                cx: Math.round(((s.bbox.x0 + s.bbox.x1) / 2 - pad) / scale),
                cy: Math.round(((s.bbox.y0 + s.bbox.y1) / 2 - pad) / scale),
              });
            }
          }
        }
      }
    }
    results.push({
      variant: name,
      preparedSize: [prepared.width, prepared.height],
      labels: [],
      candidates,
    });
  }

  // PSM 10: одиночный символ на тугих кропах остатка (после маскирования линий).
  const residue = maskLines(3, true);
  const probePoints = [
    ['C-exp', 75, 50],
    ['K-exp', 180, 105],
    ['M-exp', 228, 144],
    ['B-exp', 66, 234],
    ['A-exp', 343, 230],
  ];
  await worker.setParameters({ tessedit_pageseg_mode: '10' });
  for (const [pname, px, py] of probePoints) {
    for (const R of [16, 22]) {
      const c = document.createElement('canvas');
      c.width = R * 2 * 6;
      c.height = R * 2 * 6;
      const cctx = c.getContext('2d', { willReadFrequently: true });
      cctx.fillStyle = '#ffffff';
      cctx.fillRect(0, 0, c.width, c.height);
      cctx.imageSmoothingEnabled = false;
      cctx.drawImage(residue.canvas, px - R, py - R, R * 2, R * 2, 0, 0, R * 2 * 6, R * 2 * 6);
      const cid = cctx.getImageData(0, 0, c.width, c.height);
      const crop = { width: c.width, height: c.height, data: cid.data };
      const { data } = await worker.recognize(encodeBmp(crop), undefined, {
        blocks: true,
        text: false,
      });
      const found = [];
      for (const block of data.blocks ?? []) {
        for (const paragraph of block.paragraphs) {
          for (const line of paragraph.lines) {
            for (const word of line.words) {
              const symbols = word.symbols?.length ? word.symbols : [word];
              for (const s of symbols) {
                found.push({ text: s.text.trim(), conf: Math.round(s.confidence) });
              }
            }
          }
        }
      }
      results.push({
        variant: `psm10-${pname}-r${R}`,
        preparedSize: [px, py],
        labels: [],
        candidates: found,
      });
    }
  }
  await worker.terminate();

  // Кропы подозрительных областей (×5 nearest) для визуального осмотра.
  const cropRects = [
    ['C-area', 35, 10, 120, 90],
    ['K-area', 140, 65, 230, 145],
    ['M-area', 170, 100, 260, 180],
    ['D-area', 80, 100, 160, 180],
  ];
  const crops = cropRects.map(([name, x0, y0, x1, y1]) => {
    const c = document.createElement('canvas');
    c.width = (x1 - x0) * 5;
    c.height = (y1 - y0) * 5;
    const ctx = c.getContext('2d');
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(tmp, x0, y0, x1 - x0, y1 - y0, 0, 0, c.width, c.height);
    return { name, url: c.toDataURL('image/png') };
  });

  return {
    imageSize: [raw.width, raw.height],
    minConf: OCR_MIN_CONFIDENCE,
    labelRadius: LABEL_RADIUS,
    crops,
    segments: segments.map((s) => ({
      id: s.id,
      x1: s.x1,
      y1: s.y1,
      x2: s.x2,
      y2: s.y2,
      len: Math.round(Math.hypot(s.x2 - s.x1, s.y2 - s.y1)),
    })),
    vertices: [],
    variants: results,
  };
}
