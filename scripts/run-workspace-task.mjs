import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const supportedTasks = new Set(['build', 'lint', 'typecheck']);
const task = process.argv[2];

if (!supportedTasks.has(task)) {
  throw new Error(
    `Expected one of ${[...supportedTasks].join(', ')}; received ${task ?? 'nothing'}.`,
  );
}

const rootDir = dirname(dirname(fileURLToPath(import.meta.url)));
const turboEntrypoint = join(rootDir, 'node_modules', 'turbo', 'bin', 'turbo');
const turboResult = spawnSync(process.execPath, [turboEntrypoint, 'run', task], {
  cwd: rootDir,
  encoding: 'utf8',
  env: process.env,
});
const turboOutput = `${turboResult.stdout ?? ''}${turboResult.stderr ?? ''}`;
const isBlockedByWindowsPolicy =
  turboResult.status !== 0 &&
  /spawn UNKNOWN|Application Control policy has blocked/i.test(turboOutput);

if (!isBlockedByWindowsPolicy) {
  if (turboResult.stdout) {
    process.stdout.write(turboResult.stdout);
  }

  if (turboResult.stderr) {
    process.stderr.write(turboResult.stderr);
  }

  process.exitCode = turboResult.status ?? 1;
} else {
  console.warn(
    "Turbo's native helper is blocked by the local Windows policy; using pnpm's workspace-topological fallback.",
  );

  const fallbackArgs = [
    '--recursive',
    '--if-present',
    '--workspace-concurrency=1',
    '--filter',
    './apps/*',
    '--filter',
    './packages/*',
    'run',
    task,
  ];
  const fallbackResult =
    process.platform === 'win32'
      ? spawnSync(
          process.env.ComSpec ?? 'cmd.exe',
          ['/d', '/s', '/c', 'pnpm.cmd', ...fallbackArgs],
          {
            cwd: rootDir,
            stdio: 'inherit',
            env: process.env,
          },
        )
      : spawnSync('pnpm', fallbackArgs, {
          cwd: rootDir,
          stdio: 'inherit',
          env: process.env,
        });

  process.exitCode = fallbackResult.status ?? 1;
}
