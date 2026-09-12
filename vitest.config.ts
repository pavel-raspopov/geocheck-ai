import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['src/**/*.spec.ts'],
    server: {
      deps: {
        // OpenCV.js — UMD/CJS (~10 МБ): иначе Vite-interop дергает .then на
        // namespace → TypeError «incompatible receiver [object Module]».
        inline: ['@techstark/opencv-js'],
      },
    },
    deps: {
      interopDefault: false,
    },
  },
});
