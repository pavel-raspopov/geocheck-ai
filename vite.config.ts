import { defineConfig } from 'vite';

export default defineConfig({
  // Vanilla TS SPA. OpenCV.js / Tesseract.js подключаются лениво (await import)
  // внутри этапов пайплайна (Фазы 2–3), а не на старте приложения.
  build: {
    target: 'es2022',
    outDir: 'dist',
    emptyOutDir: true,
  },
  server: {
    port: 5173,
  },
});
