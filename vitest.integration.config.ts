import { defineConfig } from 'vitest/config';
import dotenv from 'dotenv';
import path from 'path';

// Load .env.test for integration tests
const envFile = dotenv.config({ path: '.env.test' });

export default defineConfig({
  test: {
    include: ['src/test/integration/**/*.test.ts'],
    globalSetup: 'src/test/setup.ts',
    testTimeout: 15_000,
    pool: 'forks',
    fileParallelism: false,
    env: envFile.parsed as Record<string, string> | undefined,
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
});
