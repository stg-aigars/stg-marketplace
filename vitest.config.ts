import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts', 'src/**/*.test.tsx'],
    exclude: ['src/test/integration/**'],
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      // `server-only` is a Next.js runtime-only package; vitest can't resolve
      // it. Stub it so modules guarded with `import 'server-only'` are
      // importable in tests. Production builds still enforce the boundary.
      'server-only': path.resolve(__dirname, './src/test/stubs/server-only.ts'),
    },
  },
});
