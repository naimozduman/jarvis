import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const databaseTestFiles = [
  'packages/database/test/canonical-job-lifecycle.db.integration.test.ts',
  'packages/database/test/postgres.db.integration.test.ts',
];

// Keep the dedicated gate tied to the migration, concurrency, generation, and expiry scenarios
// it is supposed to prove. An optional Vitest skip is appropriate for provider-free `pnpm test`,
// but it must not make `pnpm test:db` report success.
const requiredDatabaseTestTitles = [
  'migrates a fresh disposable database through the full chain',
  'upgrades representative schema-through-0006 rows without expiry',
  'allows exactly one matching-generation lease across separate connections',
  'rejects a held old callback after a canonical reschedule advances generation',
  'advances generation for a replacement while ordinary retries retain it',
  'serializes cancellation racing a lease and fences stale completion',
  'serializes rescheduling racing a lease without allowing an old state write',
  'enforces latest-start deadline before, at, and after it without handler execution',
  'keeps durable non-expiring work leaseable and leaves an expired reminder commitment open',
  'migrates and rolls back the atomic event/job transport boundary',
];

function validateDatabaseReport(report) {
  const errors = [];
  const assertions = Array.isArray(report.testResults)
    ? report.testResults.flatMap((file) =>
        Array.isArray(file.assertionResults) ? file.assertionResults : [],
      )
    : [];

  if (report.numTotalTests !== requiredDatabaseTestTitles.length) {
    errors.push(
      `expected ${requiredDatabaseTestTitles.length} database tests, received ${report.numTotalTests}`,
    );
  }
  if (report.numPassedTests !== requiredDatabaseTestTitles.length) {
    errors.push(
      `expected ${requiredDatabaseTestTitles.length} passed database tests, received ${report.numPassedTests}`,
    );
  }
  if (report.numFailedTests !== 0) {
    errors.push(`expected zero failed database tests, received ${report.numFailedTests}`);
  }
  if (report.numPendingTests !== 0 || report.numPendingTestSuites !== 0) {
    errors.push(
      `expected zero skipped database tests and suites, received ${report.numPendingTests} tests and ${report.numPendingTestSuites} suites`,
    );
  }
  if (report.numTodoTests !== 0) {
    errors.push(`expected zero todo database tests, received ${report.numTodoTests}`);
  }

  for (const title of requiredDatabaseTestTitles) {
    const matches = assertions.filter((assertion) => assertion.title === title);
    if (matches.length !== 1) {
      errors.push(`expected exactly one result for database case: ${title}`);
    } else if (matches[0].status !== 'passed') {
      errors.push(
        `expected database case to pass: ${title}; received ${String(matches[0].status)}`,
      );
    }
  }

  return errors;
}

if (!process.env.JARVIS_TEST_DATABASE_URL || !process.env.JARVIS_TEST_DATABASE_SECONDARY_URL) {
  console.error(
    'Database integration tests require both JARVIS_TEST_DATABASE_URL and JARVIS_TEST_DATABASE_SECONDARY_URL for separate-credential concurrency coverage.',
  );
  process.exitCode = 1;
} else {
  const vitest = process.platform === 'win32' ? 'vitest.cmd' : 'vitest';
  const reportDirectory = mkdtempSync(join(tmpdir(), 'jarvis-database-test-results-'));
  const reportPath = join(reportDirectory, 'vitest.json');
  let exitCode = 1;

  try {
    const result = spawnSync(
      vitest,
      [
        'run',
        ...databaseTestFiles,
        '--maxWorkers=1',
        '--no-file-parallelism',
        '--reporter=default',
        '--reporter=json',
        `--outputFile.json=${reportPath}`,
      ],
      {
        env: process.env,
        stdio: 'inherit',
      },
    );
    exitCode = result.status ?? 1;

    if (result.error) {
      console.error(`Database integration test runner failed to start: ${result.error.message}`);
      exitCode = 1;
    } else {
      let report;
      try {
        report = JSON.parse(readFileSync(reportPath, 'utf8'));
      } catch (error) {
        console.error(
          `Database integration test results could not be read: ${error instanceof Error ? error.message : String(error)}`,
        );
        exitCode = 1;
      }

      if (report) {
        const errors = validateDatabaseReport(report);
        console.log(
          `Dedicated database integration results: ${report.numPassedTests}/${report.numTotalTests} passed, ${report.numFailedTests} failed, ${report.numPendingTests} skipped, ${report.numTodoTests} todo.`,
        );
        if (errors.length > 0) {
          console.error(`Database integration gate failed: ${errors.join('; ')}`);
          exitCode = 1;
        }
      }
    }
  } finally {
    rmSync(reportDirectory, { recursive: true, force: true });
    process.exitCode = exitCode;
  }
}
