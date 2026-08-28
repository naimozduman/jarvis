import { spawnSync } from 'node:child_process';

const migrationUrl = process.env.JARVIS_MIGRATIONS_DATABASE_URL;

if (!migrationUrl) {
  console.error(
    'db:migrate requires JARVIS_MIGRATIONS_DATABASE_URL; it never falls back to DATABASE_URL.',
  );
  process.exitCode = 1;
} else {
  const pnpm = process.platform === 'win32' ? 'pnpm.cmd' : 'pnpm';
  const result = spawnSync(pnpm, ['--filter', '@jarvis/database', 'db:migrate'], {
    env: process.env,
    stdio: 'inherit',
  });

  process.exitCode = result.status ?? 1;
}
