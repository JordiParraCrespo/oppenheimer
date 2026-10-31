import { AppError } from '@oppenheimer/backend-core';
import { SessionErrors } from '../domain/sessions.errors';
import type {
  HostCodexEnvironments,
  HostCodexEnvironmentsOutcome,
} from './host-codex-environments.port';

/**
 * The environments a host answered with, or the problem for why there are
 * none. Every refusal of the runner's is Codex's (`SESS_009`: no `codex`, no
 * sign-in), kept as `upstreamCode` with the runner's own words as the detail.
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
    case 'failed':
      throw new AppError(SessionErrors.CODEX_ENVIRONMENTS_UNAVAILABLE, {
        detail: outcome.detail ?? `Host ${hostId} could not list its Codex environments`,
        extensions: { upstreamCode: outcome.code },
      });
  }
}
