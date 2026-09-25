import type { FlagEvaluationContext, FlagPlatform } from '@oppenheimer/shared/feature-flags';
import { activeOrganizationIdOf, type ScopedRequest } from '../../auth/domain/scope-context.types';

/** What a client reported about itself (`?platform=&appVersion=`). */
export interface ClientReportedContext {
  platform?: FlagPlatform;
  appVersion?: string;
}

function stringOf(value: unknown): string | null {
  return typeof value === 'string' && value !== '' ? value : null;
}

/**
 * Builds the evaluation context for a request: who is calling (from what the
 * auth guard resolved), which organization they are acting in, and — for a
 * client asking for its own flags — what it said about its platform and build.
 *
 * Identity always comes from the credential, never from the request body, so
 * a caller cannot evaluate a flag as someone else. An anonymous request has an
 * empty context and gets every flag's non-personal answer.
 */
export function flagContextOf(
  request: Pick<ScopedRequest, 'user' | 'session'>,
  reported: ClientReportedContext = {},
): FlagEvaluationContext {
  const user = request.user ?? null;
  return {
    userId: stringOf(user?.id),
    email: stringOf(user?.email),
    platformRole: stringOf(user?.role),
    organizationId: activeOrganizationIdOf(request),
    platform: reported.platform ?? null,
    appVersion: reported.appVersion ?? null,
  };
}
