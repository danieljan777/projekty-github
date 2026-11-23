import { defineConfig } from 'vitest/config';

export default defineConfig({
  // Testy HTML i szyfrowania budują do wspólnego dist/ — pliki muszą iść po kolei.
  test: { include: ['src/**/*.test.ts', 'tests/**/*.test.ts'], fileParallelism: false },
});
