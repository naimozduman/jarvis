import { defineConfig } from 'drizzle-kit';

/**
 * `generate` is offline. `db:migrate` requires JARVIS_MIGRATIONS_DATABASE_URL through the guarded
 * root script, so this placeholder can never silently target a real database.
 */
export default defineConfig({
  dialect: 'postgresql',
  schema: './src/schema/index.ts',
  out: './drizzle',
  dbCredentials: {
    url: process.env.JARVIS_MIGRATIONS_DATABASE_URL ?? 'postgresql://local.invalid/jarvis',
  },
  strict: true,
  verbose: true,
});
