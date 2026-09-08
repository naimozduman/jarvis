import Fastify from 'fastify';

import { registerVercelFastifyAdapter } from './src/vercel-entrypoint.js';

// Vercel's Fastify backend captures the HTTP Server created by this supported listener call. The
// entrypoint remains intentionally small: it starts no database runtime, worker, timer, Evolution
// client, or model call at module load.
const app = Fastify({ logger: false });

registerVercelFastifyAdapter(app);

void app.listen({ port: 3000 });
