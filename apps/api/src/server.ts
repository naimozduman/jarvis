import { createApiRuntime } from './runtime.js';

async function start(): Promise<void> {
  let runtime: Awaited<ReturnType<typeof createApiRuntime>> | undefined;
  let shuttingDown = false;

  try {
    runtime = await createApiRuntime();
    await runtime.start();
    const shutdown = async (): Promise<void> => {
      if (shuttingDown) {
        return;
      }
      shuttingDown = true;
      try {
        await runtime?.stop();
      } catch {
        // Runtime stop already suppresses dependency detail; retain only a safe exit status.
        process.exitCode = 1;
      }
    };
    process.once('SIGTERM', () => void shutdown());
    process.once('SIGINT', () => void shutdown());
  } catch {
    // Database drivers and providers can echo connection URLs in exceptions. Do not print them.
    await runtime?.stop();
    console.error('API startup failed: startup_dependency');
    process.exitCode = 1;
  }
}

void start();
