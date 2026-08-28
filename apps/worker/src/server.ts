import type { Server } from 'node:http';

import { loadWorkerEnvironment } from '@jarvis/config';

import { createWorkerHealthServer } from './app.js';

function listen(server: Server, port: number): Promise<void> {
  return new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(port, '0.0.0.0', () => {
      server.off('error', reject);
      resolve();
    });
  });
}

async function start(): Promise<void> {
  let server: Server | undefined;

  try {
    const environment = loadWorkerEnvironment();
    server = createWorkerHealthServer();
    await listen(server, environment.workerHealthPort);

    process.once('SIGTERM', () => {
      server?.close((error) => {
        if (error) {
          console.error(`Worker shutdown failed: ${error.message}`);
          process.exitCode = 1;
        }
      });
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown startup error';
    console.error(`Worker startup failed: ${message}`);
    server?.close();
    process.exitCode = 1;
  }
}

void start();
