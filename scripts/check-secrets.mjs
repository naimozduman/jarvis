import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, extname, join, relative, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const errors = [];

const ignoredDirectories = new Set([
  '.git',
  '.next',
  '.pnpm-store',
  '.turbo',
  'coverage',
  'dist',
  'node_modules',
]);

const ignoredExtensions = new Set(['.docx', '.gif', '.jpeg', '.jpg', '.pdf', '.png', '.zip']);
const secretPatterns = [
  {
    label: 'private key material',
    expression: /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/,
  },
  {
    label: 'OpenAI-style key',
    expression: /(?:^|[^A-Za-z0-9_])sk-[A-Za-z0-9_-]{20,}/,
  },
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

function isSecretShapedFile(path) {
  const relativePath = pathFromRoot(path);
  const filename = relativePath.split('/').at(-1) ?? '';

  if (filename === '.env.example') {
    return false;
  }

  return (
    filename === '.env' ||
    filename.startsWith('.env.') ||
    ['.key', '.pem', '.p12'].includes(extname(path))
  );
}

function scanWorkingTree() {
  for (const path of walk(root)) {
    if (isSecretShapedFile(path)) {
      errors.push(`secret-shaped file is present: ${pathFromRoot(path)}`);
      continue;
    }

    if (ignoredExtensions.has(extname(path))) {
      continue;
    }

    const contents = readFileSync(path, 'utf8');

    for (const pattern of secretPatterns) {
      if (pattern.expression.test(contents)) {
        errors.push(`possible ${pattern.label} in ${pathFromRoot(path)}`);
      }
    }
  }
}

function scanGitHistory() {
  const isRepository = spawnSync('git', ['rev-parse', '--is-inside-work-tree'], {
    cwd: root,
    encoding: 'utf8',
  });

  if (isRepository.status !== 0) {
    console.log('Git history scan skipped because this directory is not a Git worktree.');
    return;
  }

  const revisions = spawnSync('git', ['rev-list', '--all'], {
    cwd: root,
    encoding: 'utf8',
  });

  if (revisions.status !== 0) {
    errors.push('could not enumerate Git history for secret scanning');
    return;
  }

  const historyPattern = '-----BEGIN (RSA |EC |OPENSSH )?PRIVATE KEY-----|sk-[A-Za-z0-9_-]{20,}';

  for (const revision of revisions.stdout.split(/\r?\n/).filter(Boolean)) {
    const result = spawnSync('git', ['grep', '-I', '-n', '-E', historyPattern, revision], {
      cwd: root,
      encoding: 'utf8',
    });

    if (result.status === 0) {
      errors.push(`possible secret material in Git revision ${revision}`);
    } else if (result.status !== 1) {
      errors.push(`could not scan Git revision ${revision} for secrets`);
    }
  }
}

scanWorkingTree();
scanGitHistory();

if (errors.length > 0) {
  console.error('Secret scan failed.');

  for (const error of errors) {
    console.error(`- ${error}`);
  }

  process.exitCode = 1;
} else {
  const fileCount = walk(root).filter((path) => statSync(path).isFile()).length;
  console.log(`Secret scan passed (${fileCount} working-tree files checked).`);
}
