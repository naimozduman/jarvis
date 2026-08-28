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
  'docs/ADR/index.md',
  '.github/workflows/ci.yml',
  'apps/api/src/app.ts',
  'apps/api/src/health.ts',
  'apps/worker/src/app.ts',
  'apps/worker/src/health.ts',
  'apps/web/src/health.ts',
];

const requiredWorkspaces = [
  'apps/api',
  'apps/web',
  'apps/worker',
  'packages/config',
  'packages/schemas',
  'packages/database',
  'packages/domain',
  'packages/integrations',
  'packages/security',
  'packages/observability',
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
  /(?:from|import\()\s*['"](?:openai|pg-boss|drizzle-orm|@neondatabase\/serverless)['"]/i,
  /(?:from|import\()\s*['"](?:googleapis|plaid|telegram|whoop)['"]/i,
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
          errors.push(
            `provider implementation import is out of Phase 0 scope: ${pathFromRoot(path)}`,
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
