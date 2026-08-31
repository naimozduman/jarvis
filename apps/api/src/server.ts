import { createVercelApiRuntime } from './vercel-runtime.js';

// Vercel detects this Fastify entrypoint and owns the listener. The composition is explicit, but
// it starts no pg-boss loop, timer, or Evolution client in a disposable serverless instance.
const runtime = await createVercelApiRuntime();

export default runtime.app;
