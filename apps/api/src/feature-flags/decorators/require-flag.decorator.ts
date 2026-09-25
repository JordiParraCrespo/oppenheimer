import { applyDecorators, SetMetadata, UseGuards } from '@nestjs/common';
import { ApiProblemResponse } from '@oppenheimer/backend-core';
import type { BooleanFeatureFlagKey } from '@oppenheimer/shared/feature-flags';
import { FeatureFlagGuard, REQUIRE_FLAG_KEY } from '../guards/feature-flag.guard';

/**
 * Serves a route only while a flag is on for the caller; otherwise it answers
 * `FLAG_003` (403).
 *
 * The server half of a flag the UI also reads. Hiding a button is not a
 * rollout — the endpoint behind it is reachable by anyone with a token — so a
 * flag that gates a capability gates it here too, from the same catalog key:
 *
 * ```ts
 * @Post()
 * @RequireFlag('api_token_creation')
 * create() {}
 * ```
 *
 * Boolean flags only — a capability gate needs an off. A variant flag's
 * control arm is a variant like any other; branch on `valueOf` instead.
 *
 * Only the caller's identity reaches the gate, never what a client reports
 * about its platform or build: a rule on `platform` or `appVersion` does not
 * match here, so gate on flags that target identity.
 *
 * Method-level, so it runs after the controller's `ApiAuthGuard` has resolved
 * who is calling and a per-user or per-organization rollout sees them.
 * Evaluation is in memory; the decorator adds no I/O to the route.
 */
export function RequireFlag(key: BooleanFeatureFlagKey) {
  return applyDecorators(
    SetMetadata(REQUIRE_FLAG_KEY, key),
    UseGuards(FeatureFlagGuard),
    ApiProblemResponse({
      status: 403,
      description: `The "${key}" feature is switched off for the caller`,
      code: 'FLAG_003',
    }),
  );
}
