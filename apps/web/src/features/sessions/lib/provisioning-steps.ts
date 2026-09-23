import type { Step } from '@oppenheimer/design-system-web';
import type { SessionEvent, SessionStartStep } from '@oppenheimer/frontend-consumer';
import type { TFunction } from 'i18next';

/**
 * The four start steps as the `Stepper` draws them.
 *
 * Each step reads as an action while it runs and as a result once it lands —
 * the export's `BOOT_STEPS` rule — but every result here is something the host
 * reported: how long the step took, the host being reached, the agent being up.
 * The export's stand-in figures ("8 vCPU", "42 MB") are not invented to fill
 * the line.
 */
export interface ProvisioningContext {
  host: string;
  /** Null while the host list has not answered. */
  hostOnline: boolean | null;
  repo: string;
  branch: string;
  agent: string;
  /** What the host said when the start failed, if it did. */
  failure: string | null;
}

function took(step: SessionStartStep, t: TFunction): string | undefined {
  if (!step.startedAt || !step.finishedAt) return undefined;
  const seconds = (step.finishedAt.getTime() - step.startedAt.getTime()) / 1000;
  return t('sessions.provisioning.took', { seconds: seconds.toFixed(1) });
}

export function provisioningSteps(
  steps: readonly SessionStartStep[],
  context: ProvisioningContext,
  t: TFunction,
): Step[] {
  return steps.map((step) => {
    const key = `sessions.provisioning.steps.${step.id}` as const;
    const label = t(`${key}.label`, {
      host: context.host,
      repo: context.repo,
      branch: context.branch,
      agent: context.agent,
    });

    let meta: string | undefined;
    if (step.state === 'failed') {
      meta = context.failure ?? t('sessions.provisioning.failed');
    } else if (step.state === 'running') {
      meta =
        step.id === 'host' && context.hostOnline === false
          ? t('sessions.provisioning.steps.host.offline', { host: context.host })
          : t(`${key}.doing`);
    } else if (step.state === 'done') {
      // The result, once it landed: the branch the worktree is on, how long
      // the clone took, or that the host and the agent answered.
      meta =
        step.id === 'host'
          ? t('sessions.provisioning.steps.host.done')
          : step.id === 'agent'
            ? t('sessions.provisioning.steps.agent.done')
            : step.id === 'worktree'
              ? context.branch
              : took(step, t);
    }

    return { id: step.id, label, meta, state: step.state };
  });
}

/** The host's own words for why the start failed: the last `session.failed`. */
export function startFailure(events: readonly SessionEvent[]): string | null {
  const failed = [...events].reverse().find((event) => event.kind === 'session.failed');
  if (!failed?.payload || typeof failed.payload !== 'object') return null;
  const detail = (failed.payload as Record<string, unknown>).detail;
  return typeof detail === 'string' && detail.trim() ? detail : null;
}
