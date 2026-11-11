import { AppError } from '@oppenheimer/backend-core';
import type { ErrorDefinition } from '@oppenheimer/backend-ddd';
import { SessionErrors } from '../domain/sessions.errors';
import type {
  HostCodexEnvironments,
  HostCodexEnvironmentsOutcome,
} from './host-codex-environments.port';

/**
 * The runner's refusals that have an answer of their own, and the words for
 * one that came with none: ChatGPT asking it to wait (`SESS_011`), and a
 * `codex` with no ChatGPT sign-in (`SESS_022`). A code not here is Codex's
 * own refusal, `CODEX_ENVIRONMENTS_UNAVAILABLE`.
 */
const RUNNER_REFUSALS: Readonly<
  Record<string, { error: ErrorDefinition; detail: (hostId: string) => string }>
> = {
  SESS_011: {
    error: SessionErrors.CODEX_ENVIRONMENTS_RATE_LIMITED,
    detail: (hostId) => `ChatGPT asked host ${hostId} to wait`,
  },
  SESS_022: {
    error: SessionErrors.CODEX_ENVIRONMENTS_SIGNED_OUT,
    detail: (hostId) => `Codex on host ${hostId} is not signed in to ChatGPT`,
  },
};

/**
 * The environments a host answered with, or the problem for why there are
 * none. A refusal of the runner's is ChatGPT's rate limit (`SESS_011`), a 429
 * of its own, a host that is not signed in (`SESS_022`), which only
 * `codex login` on it fixes, or else Codex's (`SESS_009`: no `codex`, ChatGPT
 * unreachable); each way the runner's code is kept as `upstreamCode` and its
 * words are the detail.
 */
export function codexEnvironmentsOrThrow(
  outcome: HostCodexEnvironmentsOutcome,
  hostId: string,
): HostCodexEnvironments {
  switch (outcome.kind) {
    case 'listed':
      return outcome.listing;
    case 'host_offline':
      throw new AppError(SessionErrors.CODEX_ENVIRONMENTS_HOST_OFFLINE, {
        detail: `Host ${hostId} holds no link right now`,
      });
    case 'not_supported':
      throw new AppError(SessionErrors.CODEX_ENVIRONMENTS_UNSUPPORTED_BY_RUNNER, {
        detail: `Update the runner on host ${hostId} to pick a Codex environment on it`,
      });
    case 'timed_out':
      throw new AppError(SessionErrors.FOLDERS_TIMED_OUT, {
        detail: `Host ${hostId} did not list its Codex environments in time`,
      });
    case 'failed': {
      const known = RUNNER_REFUSALS[outcome.code];
      throw new AppError(known?.error ?? SessionErrors.CODEX_ENVIRONMENTS_UNAVAILABLE, {
        detail:
          outcome.detail ??
          known?.detail(hostId) ??
          `Host ${hostId} could not list its Codex environments`,
        extensions: { upstreamCode: outcome.code },
      });
    }
  }
}
