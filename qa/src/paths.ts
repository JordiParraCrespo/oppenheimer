import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

/** `qa/` itself — everything else in the pack is resolved from here. */
export const QA_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
/** The monorepo root, so the harness can run repo-level commands. */
export const REPO_ROOT = resolve(QA_ROOT, '..');
export const SCENARIOS_DIR = resolve(QA_ROOT, 'scenarios');
/** Run output: screenshots, logs, the results file. Not in version control. */
export const ARTIFACTS_DIR = resolve(QA_ROOT, 'artifacts');
export const SCREENSHOTS_DIR = resolve(ARTIFACTS_DIR, 'screenshots');
export const RESULTS_FILE = resolve(ARTIFACTS_DIR, 'results.json');
export const REPORT_FILE = resolve(ARTIFACTS_DIR, 'report.md');
/** Where the API's console-logged mail lands, and the harness reads it back. */
export const API_LOG = resolve(ARTIFACTS_DIR, 'api.log');
