import type { Step } from '@oppenheimer/design-system-web';
import type { SessionStartStep } from '@oppenheimer/frontend-consumer';
import { SESSION_START_STEPS } from '@oppenheimer/shared/protocol';
import type { TFunction } from 'i18next';

/**
 * The start steps as `Stepper` rows: a label naming what the step acts on, and
 * a meta line that reads as an action while it runs and as a result once it
 * lands — the time the host measured, the branch, "Connected", "Ready".
 */
export interface ProvisioningContext {
  host: string;
  /** The row's `host_offline` hint: the start is waiting on a machine that is away. */
  hostOffline: boolean;
  repo: string;
  branch: string;
  agent: string;
  /** The host's reason for a failed start, once the log carries it. */
  failure: string | null;
}

/** Before the first read answers, every step is pending. */
export const PENDING_START: SessionStartStep[] = SESSION_START_STEPS.map((id) => ({
  id,
  state: 'pending',
  durationMs: null,
}));

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
      agent: context.agent,
    });
    return { id: step.id, label, meta: meta(step, context, t), state: step.state };
  });
}

function meta(step: SessionStartStep, context: ProvisioningContext, t: TFunction) {
  const key = `sessions.provisioning.steps.${step.id}` as const;
  switch (step.state) {
    case 'failed':
      return context.failure ?? t('sessions.provisioning.failed');
    case 'running':
      return t(`${key}.doing`);
    case 'pending':
      // The one thing worth saying about a step nobody has reported: the
      // machine it waits on is away.
      return step.id === 'host' && context.hostOffline
        ? t('sessions.provisioning.steps.host.offline', { host: context.host })
        : undefined;
    case 'done':
      if (step.id === 'host') return t('sessions.provisioning.steps.host.done');
      if (step.id === 'agent') return t('sessions.provisioning.steps.agent.done');
      if (step.id === 'worktree') return context.branch;
      return step.durationMs === null
        ? undefined
        : t('sessions.provisioning.took', { seconds: (step.durationMs / 1000).toFixed(1) });
  }
}

/**
 * Runner codes that read differently on this screen than in the shared
 * catalog: said in the console's words, for what a person can do about them.
 */
const KNOWN_FAILURE_CODES = ['SESS_002'] as const;

type KnownFailureCode = (typeof KNOWN_FAILURE_CODES)[number];

function isKnownFailureCode(code: string): code is KnownFailureCode {
  return (KNOWN_FAILURE_CODES as readonly string[]).includes(code);
}

/** Why a start failed, in the reader's language, and the host's own words beside it. */
export interface FailureReason {
  /** Translated: the code's meaning, or the generic line when it has none. */
  reason: string;
  /** The host's raw detail, English, for a secondary "details" line only. */
  detail: string | null;
}

/**
 * What to put under a failed step. The host's `detail` is English written for
 * an operator, so it is never the reason itself: the code picks the sentence —
 * this screen's own copy first, then the shared `errors.byCode` catalog through
 * `translateCode` — and a code neither knows reads as the generic failure. The
 * detail rides along for the screen to show as a secondary line.
 */
export function failureReason(
  failure: { code: string | null; detail: string | null } | null | undefined,
  t: TFunction,
  translateCode: (code: string) => string | undefined,
): FailureReason | null {
  if (!failure) return null;
  const { code, detail } = failure;
  const reason =
    code && isKnownFailureCode(code)
      ? t(`sessions.provisioning.codes.${code}`)
      : ((code ? translateCode(code) : undefined) ?? t('sessions.provisioning.failed'));
  return { reason, detail };
}
