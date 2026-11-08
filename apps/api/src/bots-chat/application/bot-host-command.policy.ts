import { createHash } from 'node:crypto';
import type { HostExecOutcome } from '../../sessions/application/host-exec.port';
import { cut, fenceUntrusted } from '../domain/bot-tool-text.policy';

/**
 * What each of the runner's refusals means, said plainly, so the bot does
 * not guess (EXEC_001 read as "not on the list" sends the person to the
 * wrong fix).
 */
const REFUSALS: Readonly<Record<string, string>> = {
  EXEC_001: 'running commands is switched off on this host',
  EXEC_002: 'this program is not on the host’s allowlist',
  EXEC_003: 'the folder to run in is missing or unusable',
  EXEC_004: 'the program could not be started, or the host is already running 8 commands',
  EXEC_005: 'the host’s own exec policy file cannot be read',
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
        ? 'Stopped at its timeout, before it finished.'
        : run.exitCode === null
          ? 'Ended by a signal.'
          : `Exit code ${run.exitCode}.`;
      const lines = [`Ran on ${host} in ${run.cwd} (${run.durationMs} ms). ${ended}`];
      lines.push(stream('stdout', run.stdout, run.stdoutTruncated));
      lines.push(stream('stderr', run.stderr, run.stderrTruncated));
      return lines.join('\n\n');
    }
    case 'host_offline':
      return `${host} is offline: nothing ran. Try again when it is back, or use another host.`;
    case 'not_supported':
      return `The runner on ${host} is too old to run commands: nothing ran. The person can update it from the host's page.`;
    case 'timed_out':
      return `${host} did not answer in time, so whether it ran is unknown. Check before running it again.`;
    case 'failed': {
      const meaning = REFUSALS[outcome.code];
      return `${host} refused (${outcome.code}${meaning ? `: ${meaning}` : ''}): ${outcome.detail ?? 'no reason given'}. Nothing ran. Tell the person; only they can change what this host allows, on the host itself.`;
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
