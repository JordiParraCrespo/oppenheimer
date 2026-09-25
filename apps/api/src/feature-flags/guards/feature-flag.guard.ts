import { type CanActivate, type ExecutionContext, Inject, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AppError } from '@oppenheimer/backend-core';
import type { BooleanFeatureFlagKey } from '@oppenheimer/shared/feature-flags';
import type { ScopedRequest } from '../../auth/domain/scope-context.types';
import { flagContextOf } from '../application/flag-context.resolver';
import type { FlagEvaluatorPort } from '../application/flag-evaluator.port';
import { FeatureFlagErrors } from '../domain/feature-flags.errors';
import { FLAG_EVALUATOR } from '../feature-flags.di-tokens';

/** Metadata key `@RequireFlag` writes the flag under. */
export const REQUIRE_FLAG_KEY = 'feature-flags:require';

/**
 * Enforces `@RequireFlag`. Throws the catalog error rather than returning
 * `false`, which would surface as Nest's codeless 403 that no client can
 * branch on.
 */
@Injectable()
export class FeatureFlagGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    @Inject(FLAG_EVALUATOR)
    private readonly evaluator: FlagEvaluatorPort,
  ) {}

  canActivate(context: ExecutionContext): boolean {
    const key = this.reflector.getAllAndOverride<BooleanFeatureFlagKey | undefined>(
      REQUIRE_FLAG_KEY,
      [context.getHandler(), context.getClass()],
    );
    if (!key) return true;

    const request = context.switchToHttp().getRequest<ScopedRequest>();
    if (this.evaluator.isEnabled(key, flagContextOf(request))) return true;

    throw new AppError(FeatureFlagErrors.FEATURE_DISABLED, {
      detail: `The "${key}" feature is switched off.`,
      extensions: { flag: key },
    });
  }
}
