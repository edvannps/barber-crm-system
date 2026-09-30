import swc from 'unplugin-swc';
import { defineConfig } from 'vitest/config';

// SWC emite metadata de decorators, necessária para a injeção de dependência do NestJS.
export default defineConfig({
  plugins: [swc.vite()],
  test: { include: ['src/**/*.spec.ts', 'test/**/*.spec.ts'] },
});
