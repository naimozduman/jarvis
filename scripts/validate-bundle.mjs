import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, extname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const errors = [];

const requiredFiles = [
  'AGENTS.md',
  'docs/PRD.md',
  'docs/ARCHITECTURE.md',
  'docs/SECURITY.md',
  'docs/BUILD_PLAN.md',
  'BUILD_ORDER.md',
  'docs/ADR/index.md',
  'docs/ADR/0005-phase-sequence.md',
  'docs/ADR/0006-contracts-boundary.md',
  'docs/ADR/0007-postgres-durable-jobs.md',
  'docs/DATA_MODEL.md',
  'docs/EVENT_MODEL.md',
  'docs/JOB_LIFECYCLE.md',
  'docs/POLICY_MATRIX.md',
  'docs/APPROVAL_MODEL.md',
  'docs/AUDIT_MODEL.md',
  'docs/AUTHENTICATION_BOUNDARY.md',
  'docs/progress/phase-1.md',
  'docs/progress/phase-2.md',
  'docs/BRAIN_ARCHITECTURE.md',
  'docs/CONSTITUTION_ENGINE.md',
  'docs/MEMORY_ENGINE.md',
  'docs/CONTEXT_ASSEMBLY.md',
  'docs/ACCOUNTABILITY_ENGINE.md',
  'docs/BEHAVIOR_ENGINE.md',
  'docs/REPLANNING_ENGINE.md',
  'docs/REMINDER_ENGINE.md',
  'docs/MODEL_RUNTIME.md',
  'docs/PROMPT_ARCHITECTURE.md',
  'docs/BRAIN_EVALS.md',
  'docs/WHATSAPP_ARCHITECTURE.md',
  'docs/EVOLUTION_INTEGRATION.md',
  'docs/EVOLUTION_VERSION_GATE.md',
  'docs/WHATSAPP_SECURITY.md',
  'docs/WHATSAPP_IDENTITY.md',
  'docs/WHATSAPP_RECOVERY.md',
  'docs/OUTBOUND_DELIVERY.md',
  'docs/MEDIA_PIPELINE.md',
  'docs/RAILWAY_PHASE3_PLAN.md',
  'docs/progress/phase-3.md',
  'docs/ZERO_COST_ARCHITECTURE.md',
  'docs/CONVEX_ORCHESTRATION.md',
  'docs/VERCEL_RUNTIME.md',
  'docs/VERCEL_AI_GATEWAY.md',
  'docs/LOCAL_WHATSAPP_BRIDGE.md',
  'docs/OFFLINE_TRANSPORT.md',
  'docs/progress/phase-3-6.md',
  'docs/ADR/0012-zero-cost-stateless-runtime.md',
  'docs/ADR/0013-opaque-convex-local-bridge.md',
  'docs/ADR/0014-canonical-delivery-leases-and-expiry.md',
  '.github/workflows/ci.yml',
  'apps/api/src/app.ts',
  'apps/api/src/health.ts',
  'apps/api/src/local-bridge-routes.ts',
  'apps/api/src/orchestration-routes.ts',
  'apps/api/src/vercel-runtime.ts',
  'apps/whatsapp-bridge/src/bridge.ts',
  'apps/whatsapp-bridge/src/server.ts',
  'apps/whatsapp-bridge/src/vercel-api-client.ts',
  'apps/worker/src/app.ts',
  'apps/worker/src/health.ts',
  'apps/web/src/health.ts',
  'packages/database/src/delivery-lifecycle.ts',
  'packages/database/src/transport-repository.ts',
  'packages/orchestration/src/canonical-job-executor.ts',
  'packages/orchestration/src/canonical-transport-processor.ts',
  'convex/http.ts',
  'convex/schema.ts',
  'convex/scheduler.ts',
  'convex/transportSignals.ts',
];

const requiredWorkspaces = [
  'apps/api',
  'apps/web',
  'apps/whatsapp-bridge',
  'apps/worker',
  'packages/config',
  'packages/brain',
  'packages/contracts',
  'packages/schemas',
  'packages/database',
  'packages/domain',
  'packages/integrations',
  'packages/integrations-evolution',
  'packages/security',
  'packages/observability',
  'packages/orchestration',
  'packages/testing',
];

const ignoredDirectories = new Set([
  '.git',
  '.next',
  '.pnpm-store',
  '.turbo',
  'coverage',
  'dist',
  'node_modules',
]);

const forbiddenProviderImports = [
  /(?:from|import\()\s*['"](?:@neondatabase\/serverless|googleapis|@google\/|plaid|telegram|whoop|evolution-api|@evolution-api|baileys|@whiskeysockets\/baileys)['"]/i,
];

const allowedEvolutionAdapterRoot = 'packages/integrations-evolution/src/';

const openAiProviderImport = /(?:from|import\()\s*['"]openai(?:\/[^'"]*)?['"]/i;
const allowedOpenAiAdapters = new Set([
  'packages/brain/src/model/openai-responses-gateway.ts',
  // The Gateway adapter uses the OpenAI-compatible SDK transport with a fixed Vercel base URL
  // and OIDC credential; it never falls back to the direct OpenAI adapter.
  'packages/brain/src/model/vercel-ai-gateway.ts',
]);

const databaseImplementationImports = [
  /(?:from|import\()\s*['"](?:drizzle-orm(?:\/[^'"]*)?|pg-boss|pg)['"]/i,
];

function pathFromRoot(path) {
  return relative(root, path).replaceAll('\\', '/');
}

function walk(directory) {
  const paths = [];

  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    if (entry.isDirectory() && ignoredDirectories.has(entry.name)) {
      continue;
    }

    const absolutePath = join(directory, entry.name);

    if (entry.isDirectory()) {
      paths.push(...walk(absolutePath));
    } else if (entry.isFile()) {
      paths.push(absolutePath);
    }
  }

  return paths;
}

function readText(path) {
  return readFileSync(path, 'utf8');
}

function validateJson(path) {
  try {
    JSON.parse(readText(path));
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown JSON parsing error';
    errors.push(`invalid JSON in ${pathFromRoot(path)}: ${message}`);
  }
}

function validateWorkspace(path) {
  const manifestPath = join(root, path, 'package.json');
  const tsconfigPath = join(root, path, 'tsconfig.json');

  if (!existsSync(manifestPath)) {
    errors.push(`missing workspace manifest: ${path}/package.json`);
    return;
  }

  if (!existsSync(tsconfigPath)) {
    errors.push(`missing workspace TypeScript config: ${path}/tsconfig.json`);
  }

  try {
    const manifest = JSON.parse(readText(manifestPath));

    if (manifest.private !== true) {
      errors.push(`workspace must be private: ${path}/package.json`);
    }

    for (const script of ['build', 'lint', 'typecheck']) {
      if (typeof manifest.scripts?.[script] !== 'string') {
        errors.push(`workspace missing ${script} script: ${path}/package.json`);
      }
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown manifest parsing error';
    errors.push(`invalid workspace manifest ${path}/package.json: ${message}`);
  }
}

for (const path of requiredFiles) {
  if (!existsSync(join(root, path))) {
    errors.push(`missing required file: ${path}`);
  }
}

for (const path of requiredWorkspaces) {
  validateWorkspace(path);
}

for (const path of walk(root)) {
  if (extname(path) === '.json') {
    validateJson(path);
  }

  if (path.includes(`${join(root, 'apps')}`) || path.includes(`${join(root, 'packages')}`)) {
    if (extname(path) === '.ts') {
      const source = readText(path);

      for (const pattern of forbiddenProviderImports) {
        if (pattern.test(source)) {
          const relativePath = pathFromRoot(path);
          if (!relativePath.startsWith(allowedEvolutionAdapterRoot)) {
            errors.push(
              `provider implementation import is outside the Evolution adapter boundary: ${relativePath}`,
            );
          }
        }
      }

      if (openAiProviderImport.test(source) && !allowedOpenAiAdapters.has(pathFromRoot(path))) {
        errors.push(
          `OpenAI-compatible provider import is outside its approved adapter boundary: ${pathFromRoot(path)}`,
        );
      }

      for (const pattern of databaseImplementationImports) {
        if (pattern.test(source) && !pathFromRoot(path).startsWith('packages/database/')) {
          errors.push(
            `database implementation import is outside @jarvis/database: ${pathFromRoot(path)}`,
          );
        }
      }
    }
  }
}

const decisionIndexPath = join(root, 'docs', 'ADR', 'index.md');

if (existsSync(decisionIndexPath)) {
  const decisionIndex = readText(decisionIndexPath);

  for (const decision of [
    '0001-stack',
    '0002-evolution-transport',
    '0003-single-orchestrator',
    '0004-read-only-finance',
    '0005-phase-sequence',
    '0006-contracts-boundary',
    '0007-postgres-durable-jobs',
    '0008-stateless-model-runtime',
    '0009-brain-action-intent-boundary',
    '0010-deterministic-context-and-epistemic-memory',
    '0011-evolution-version-gate-and-owner-only-transport',
    '0012-zero-cost-stateless-runtime',
    '0013-opaque-convex-local-bridge',
    '0014-canonical-delivery-leases-and-expiry',
  ]) {
    if (!decisionIndex.includes(decision)) {
      errors.push(`architecture decision index does not reference ${decision}`);
    }
  }
}

if (errors.length > 0) {
  console.error('Bundle validation failed.');

  for (const error of errors) {
    console.error(`- ${error}`);
  }

  process.exitCode = 1;
} else {
  const fileCount = walk(root).filter((path) => statSync(path).isFile()).length;
  console.log(`Bundle validation passed (${fileCount} files checked).`);
}
