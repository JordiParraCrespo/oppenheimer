import type { Step } from '@oppenheimer/design-system-web';
import type { SessionStartStep } from '@oppenheimer/frontend-consumer';
import { SESSION_START_STEPS } from '@oppenheimer/shared/protocol';
import type { TFunction } from 'i18next';

export interface ProvisioningContext {
  host: string;
  /** The row's `host_offline` hint: the start is waiting on a machine that is away. */
  hostOffline: boolean;
  repo: string;
  branch: string;
  agent: string;
  /** The host's reason for a failed start, once the log carries it. */
  failure: string | null;
  /**
   * A folder session's folder, as shown: nothing is cloned and no branch is
   * made, so the start is the host, opening the folder, and the agent
   * (`product/versions/mvp/24-session-places.md` §3).
   */
  folder?: string | null;
  /** The blank terminal: its last step starts a shell, not an agent. */
  shell?: boolean;
}

/** A start step as this pane draws it: the host's own, or a folder session's one `open`. */
type ShownStep = Omit<SessionStartStep, 'id'> & { id: SessionStartStep['id'] | 'open' };

/** Before the first read answers, every step is pending. */
export const PENDING_START: SessionStartStep[] = SESSION_START_STEPS.map((id) => ({
  id,
  state: 'pending',
  durationMs: null,
  download: false,
}));

/**
 * The start steps as `Stepper` rows: a label naming what the step acts on, and
 * a meta line that reads as an action while it runs and as a result once it
 * lands — the time the host measured, the branch, "Connected", "Ready".
 */
export function provisioningSteps(
  steps: readonly SessionStartStep[],
  context: ProvisioningContext,
  t: TFunction,
): Step[] {
  const shown: readonly ShownStep[] = context.folder ? folderSteps(steps) : steps;
  return shown.map((step) => {
    const key = `sessions.provisioning.steps.${step.id}` as const;
    const label =
      step.id === 'agent' && context.shell
        ? t('sessions.provisioning.steps.agent.shell')
        : t(`${key}.label`, {
            host: context.host,
            repo: context.repo,
            agent: context.agent,
            path: context.folder ?? '',
          });
    return { id: step.id, label, meta: meta(step, context, t), state: step.state };
  });
}

/**
 * A folder session's start: the host, then the folder — the one step that
 * stands for what a worktree session spends on the clone and the branch,
 * which a runner reports for a folder only if it reports them at all — then
 * the agent. Opening the folder is done once the agent has started, under way
 * once the host has the session, and failed when either of its steps did.
 */
function folderSteps(steps: readonly SessionStartStep[]): ShownStep[] {
  const byId = new Map(steps.map((step) => [step.id, step]));
  const host = byId.get('host');
  const agent = byId.get('agent');
  const opening = [byId.get('clone'), byId.get('worktree')].filter((step) => step !== undefined);
  const state: SessionStartStep['state'] = opening.some((step) => step.state === 'failed')
    ? 'failed'
    : agent && agent.state !== 'pending'
      ? 'done'
      : opening.some((step) => step.state === 'running') || host?.state === 'done'
        ? 'running'
        : 'pending';
  const open: ShownStep = { id: 'open', state, durationMs: null, download: false };
  return [host, open, agent].filter((step) => step !== undefined);
}

function meta(step: ShownStep, context: ProvisioningContext, t: TFunction) {
  const key = `sessions.provisioning.steps.${step.id}` as const;
  switch (step.state) {
    case 'failed':
      return context.failure ?? t('sessions.provisioning.failed');
    case 'running':
      // A first download is not the quick fetch every later session makes.
      return step.download ? t('sessions.provisioning.steps.clone.downloading') : t(`${key}.doing`);
    case 'pending':
      // The one thing worth saying about a step nobody has reported: the
      // machine it waits on is away.
      return step.id === 'host' && context.hostOffline
        ? t('sessions.provisioning.steps.host.offline', { host: context.host })
        : undefined;
    case 'done':
      if (step.id === 'host') return t('sessions.provisioning.steps.host.done');
      if (step.id === 'agent') return t('sessions.provisioning.steps.agent.done');
      if (step.id === 'open') return t('sessions.provisioning.steps.open.done');
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
