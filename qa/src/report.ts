import type { ScenarioPack } from './scenarios.js';

export interface RecordedCheck {
  label: string;
  ok: boolean;
  detail?: string;
}

export interface RecordedShot {
  name: string;
  file: string;
  caption: string;
}

export interface ScenarioResult {
  id: string;
  title: string;
  theme: string;
  severity: string;
  status: 'passed' | 'failed';
  durationMs: number;
  checks: RecordedCheck[];
  screenshots: RecordedShot[];
  notes: string[];
  error?: string;
}

export interface RunResults {
  startedAt: string;
  finishedAt: string;
  scenarios: ScenarioResult[];
}

const STATUS_MARK = { passed: '🟢', failed: '🔴' } as const;

/**
 * The run, written out as something a person reads rather than a machine.
 *
 * Deliberately organised by scenario and not by assertion: the unit anyone
 * cares about is "does password reset work", and an assertion count answers a
 * different question. Failed checks are listed in full, because the report is
 * the draft of whatever issue gets opened next.
 */
export function renderReport(pack: ScenarioPack, results: RunResults): string {
  const lines: string[] = [];
  const failed = results.scenarios.filter((result) => result.status === 'failed');
  const passed = results.scenarios.filter((result) => result.status === 'passed');

  lines.push(`# QA run — ${pack.pack}`);
  lines.push('');
  lines.push(`${results.startedAt} → ${results.finishedAt}`);
  lines.push('');
  lines.push(
    `**${passed.length} passed, ${failed.length} failed** across ${results.scenarios.length} scenarios.`,
  );
  lines.push('');

  lines.push('| | Scenario | Severity | Checks | Screenshots |');
  lines.push('| --- | --- | --- | --- | --- |');
  for (const result of results.scenarios) {
    const bad = result.checks.filter((check) => !check.ok).length;
    const checks = `${result.checks.length - bad}/${result.checks.length}`;
    lines.push(
      `| ${STATUS_MARK[result.status]} | \`${result.id}\` ${result.title} | ${result.severity} | ${checks} | ${result.screenshots.length} |`,
    );
  }
  lines.push('');

  for (const result of results.scenarios) {
    lines.push(`## ${STATUS_MARK[result.status]} ${result.id} — ${result.title}`);
    lines.push('');
    lines.push(`*${result.theme} · ${result.severity} · ${Math.round(result.durationMs)}ms*`);
    lines.push('');
    for (const note of result.notes) lines.push(`> ${note}`);
    if (result.notes.length > 0) lines.push('');
    for (const check of result.checks) {
      const mark = check.ok ? '- ✅' : '- ❌';
      lines.push(`${mark} ${check.label}${check.detail ? ` — ${check.detail}` : ''}`);
    }
    lines.push('');
    if (result.screenshots.length > 0) {
      for (const shot of result.screenshots) {
        lines.push(`![${shot.caption}](screenshots/${shot.file})`);
        lines.push('');
      }
    }
    if (result.error) {
      lines.push('```');
      lines.push(result.error);
      lines.push('```');
      lines.push('');
    }
  }

  return lines.join('\n');
}
