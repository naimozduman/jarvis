import { spawnSync } from 'node:child_process';

if (!process.env.JARVIS_TEST_DATABASE_URL) {
  console.log('Database integration tests skipped: JARVIS_TEST_DATABASE_URL is not set.');
} else {
  const vitest = process.platform === 'win32' ? 'vitest.cmd' : 'vitest';
  const result = spawnSync(vitest, ['run', 'packages/database/test/**/*.db.integration.test.ts'], {
    env: process.env,
    stdio: 'inherit',
  });

  process.exitCode = result.status ?? 1;
}
