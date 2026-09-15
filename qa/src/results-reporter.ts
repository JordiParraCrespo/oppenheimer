import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import type { Reporter } from '@playwright/test/reporter';
import { ARTIFACTS_DIR, REPORT_FILE, RESULTS_FILE } from './paths.js';
import { type RunResults, renderReport, type ScenarioResult } from './report.js';
import { loadPack } from './scenarios.js';

const VERDICTS_DIR = join(ARTIFACTS_DIR, 'verdicts');

/**
 * Collects the per-scenario verdicts the harness wrote and turns them into one
 * results file and one readable report.
 *
 * The scenarios write their own verdicts rather than having them reconstructed
 * from Playwright's events, because the interesting content — which check
 * failed, what the database said, which screenshot shows it — only exists
 * inside the test. What this adds is the run-level view.
 */
export default class QaResultsReporter implements Reporter {
  private startedAt = new Date().toISOString();

  onBegin(): void {
    this.startedAt = new Date().toISOString();
    // Clear last run's verdicts so a scenario that has since been deleted (or
    // did not run this time) cannot leave a stale row in the report.
    rmSync(VERDICTS_DIR, { recursive: true, force: true });
    mkdirSync(VERDICTS_DIR, { recursive: true });
  }

  async onEnd(): Promise<{ status: 'failed' } | undefined> {
    const scenarios: ScenarioResult[] = existsSync(VERDICTS_DIR)
      ? readdirSync(VERDICTS_DIR)
          .filter((file) => file.endsWith('.json'))
          .map(
            (file) => JSON.parse(readFileSync(join(VERDICTS_DIR, file), 'utf8')) as ScenarioResult,
          )
          .sort((a, b) => a.id.localeCompare(b.id))
      : [];

    // Every scenario names the screenshots it promises to produce, and the
    // pack's standing rule is that a scenario which passes without its
    // evidence has been asserted rather than verified. So a missing artifact
    // fails the scenario and the run: a warning would let a screenshot call
    // get removed, renamed or skipped while the checks still went green, which
    // is exactly the drift the rule exists to catch.
    const pack = loadPack();
    const withoutEvidence: string[] = [];
    for (const result of scenarios) {
      const promised = pack.scenarios.find((entry) => entry.id === result.id)?.artifacts ?? [];
      const taken = new Set(result.screenshots.map((shot) => shot.file));
      const missing = promised.filter((file) => !taken.has(file));
      if (missing.length === 0) continue;
      withoutEvidence.push(`${result.id} (${missing.join(', ')})`);
      result.status = 'failed';
      result.checks.push({
        label: 'the scenario produced the screenshots it promised',
        ok: false,
        detail: `missing: ${missing.join(', ')}`,
      });
    }

    // Written only now, after the evidence loop has had its say. Writing them
    // first left the verdict on disk disagreeing with the verdict in the exit
    // code: `qa report` re-rendered the stale JSON and `qa publish` could carry
    // a scenario marked passed into `docs/screenshots/` while the run that
    // produced it had failed for missing evidence.
    const results: RunResults = {
      startedAt: this.startedAt,
      finishedAt: new Date().toISOString(),
      scenarios,
    };
    mkdirSync(ARTIFACTS_DIR, { recursive: true });
    writeFileSync(RESULTS_FILE, JSON.stringify(results, null, 2));
    writeFileSync(REPORT_FILE, renderReport(pack, results));

    const failed = scenarios.filter((scenario) => scenario.status === 'failed');
    console.log(
      `\nqa: ${scenarios.length - failed.length}/${scenarios.length} scenarios passed — ` +
        `report at ${REPORT_FILE}`,
    );
    for (const scenario of failed) {
      console.log(`  🔴 ${scenario.id} ${scenario.title}`);
      for (const check of scenario.checks.filter((check) => !check.ok)) {
        console.log(`      · ${check.label}${check.detail ? ` — ${check.detail}` : ''}`);
      }
    }

    // Playwright already failed the run for a scenario that threw. This
    // overrides the status for the one case it cannot see: a scenario whose
    // checks all passed but whose evidence never got taken.
    if (withoutEvidence.length > 0) {
      console.log(`\nqa: scenarios missing promised evidence — ${withoutEvidence.join('; ')}`);
      return { status: 'failed' };
    }
    return undefined;
  }
}
