import { createVercelFetchHandler } from '../src/vercel-entrypoint.js';

// Vercel's Node.js Web-Handler format. This single catch-all Function owns the `/api/*` surface
// and delegates the remaining path to Fastify without opening a server port.
export default {
  fetch: createVercelFetchHandler(),
};
