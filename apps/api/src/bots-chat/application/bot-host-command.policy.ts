import { createHash } from 'node:crypto';
import type { HostExecOutcome } from '../../sessions/application/host-exec.port';
import { promptText } from '../domain/bot-prompt-text.policy';
import { cut, fenceUntrusted } from '../domain/bot-tool-text.policy';

/**
 * What each of the runner's refusals means, said plainly, so the bot does
 * not guess (EXEC_001 read as "not on the list" sends the person to the
 * wrong fix).
 */
const REFUSALS: Readonly<Record<string, string>> = {
  EXEC_001: promptText('tools/host-command.refusals-exec-001'),
  EXEC_002: promptText('tools/host-command.refusals-exec-002'),
  EXEC_003: promptText('tools/host-command.refusals-exec-003'),
  EXEC_004: promptText('tools/host-command.refusals-exec-004'),
  EXEC_005: promptText('tools/host-command.refusals-exec-005'),
};

/** How much of the command line a Needs input card shows. */
const SUMMARY_MAX = 200;

/** An argument as a shell would need it written, so the card reads as one line. */
function quoted(arg: string): string {
  return /^[\w@%+=:,./-]+$/.test(arg) ? arg : `'${arg.replaceAll("'", `'\\''`)}'`;
}

/** The Needs input card's line for a `run_command` call: "Run `python3 report.py` on build-02". */
export function hostCommandSummary(argv: readonly string[], host: string, cwd?: string): string {
  const line = cut(argv.map(quoted).join(' '), SUMMARY_MAX);
  return `Run \`${line}\` on ${host}${cwd ? ` in ${cut(cwd, SUMMARY_MAX)}` : ''}`;
}

/**
 * What a `run_command` call came to, in words the model reads. A run is an
 * answer whatever its exit code; the output is fenced as data, since what a
 * program prints is outside text. A refusal by the host says who can change
 * it, so the bot passes it on instead of trying around it.
 */
export function describeHostCommand(outcome: HostExecOutcome, host: string): string {
  switch (outcome.kind) {
    case 'ran': {
      const { run } = outcome;
      const ended = run.timedOut
        ? promptText('tools/host-command.stopped-at-timeout')
        : run.exitCode === null
          ? 'Ended by a signal.'
          : `Exit code ${run.exitCode}.`;
      const lines = [`Ran on ${host} in ${run.cwd} (${run.durationMs} ms). ${ended}`];
      lines.push(stream('stdout', run.stdout, run.stdoutTruncated));
      lines.push(stream('stderr', run.stderr, run.stderrTruncated));
      return lines.join('\n\n');
    }
    case 'host_offline':
      return promptText('tools/host-command.host-offline', { host });
    case 'not_supported':
      return promptText('tools/host-command.describe-host-command-runner-too-old', { host });
    case 'timed_out':
      return promptText('tools/host-command.describe-host-command-did-answer-time', { host });
    case 'failed': {
      const meaning = REFUSALS[outcome.code];
      return promptText('tools/host-command.host-refused', {
        host,
        code: outcome.code,
        meaning: meaning ? `: ${meaning}` : '',
        detail: outcome.detail ?? 'no reason given',
      });
    }
  }
}

function stream(name: 'stdout' | 'stderr', text: string, truncated?: boolean): string {
  if (text === '') return `${name}: (empty)`;
  const note = truncated ? ' (only its last 32 KB)' : '';
  return `${name}${note}:\n${fenceUntrusted('command_output', text)}`;
}

/**
 * The `host.exec` command id of an approved call: the same for every retry
 * of that approval's job, so a worker that crashed after the host ran the
 * program gets that run's result back instead of running it a second time
 * with no second approval. UUID-shaped, as the link's command ids are.
 */
export function hostCommandIdOf(approvalId: string): string {
  const hex = createHash('sha256').update(`host.exec:${approvalId}`).digest('hex');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-8${hex.slice(13, 16)}-a${hex.slice(17, 20)}-${hex.slice(20, 32)}`;
}
