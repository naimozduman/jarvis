import { fileURLToPath } from 'node:url';

import { defineConfig } from 'vitest/config';

const fromRoot = (path: string) => fileURLToPath(new URL(path, import.meta.url));

export default defineConfig({
  resolve: {
    alias: {
      '@jarvis/api': fromRoot('./apps/api/src/index.ts'),
      '@jarvis/brain': fromRoot('./packages/brain/src/index.ts'),
      '@jarvis/config': fromRoot('./packages/config/src/index.ts'),
      '@jarvis/contracts': fromRoot('./packages/contracts/src/index.ts'),
      '@jarvis/database': fromRoot('./packages/database/src/index.ts'),
      '@jarvis/domain': fromRoot('./packages/domain/src/index.ts'),
      '@jarvis/integrations': fromRoot('./packages/integrations/src/index.ts'),
      '@jarvis/integrations-evolution': fromRoot('./packages/integrations-evolution/src/index.ts'),
      '@jarvis/observability': fromRoot('./packages/observability/src/index.ts'),
      '@jarvis/orchestration': fromRoot('./packages/orchestration/src/index.ts'),
      '@jarvis/schemas': fromRoot('./packages/schemas/src/index.ts'),
      '@jarvis/security': fromRoot('./packages/security/src/index.ts'),
      '@jarvis/testing': fromRoot('./packages/testing/src/index.ts'),
      '@jarvis/web': fromRoot('./apps/web/src/index.ts'),
      '@jarvis/worker': fromRoot('./apps/worker/src/index.ts'),
    },
  },
  test: {
    environment: 'node',
    include: ['apps/**/*.test.ts', 'packages/**/*.test.ts', 'scripts/**/*.test.mjs'],
    passWithNoTests: false,
  },
});
