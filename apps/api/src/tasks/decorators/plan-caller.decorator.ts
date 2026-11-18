import { createParamDecorator, type ExecutionContext } from '@nestjs/common';
import type { TaskOrigin } from '@oppenheimer/shared';
import type { ScopedRequest } from '../../auth/domain/scope-context.types';
import { taskOriginOf } from '../application/task-origin.policy';
import { type PlanActor, userActor } from '../domain/plan-change.types';

/** Who a request to Plan is from: the person it acts for, and whether they made it or an agent did. */
export interface PlanCallerOf {
  actor: PlanActor;
  origin: TaskOrigin;
}

/**
 * The caller of a Plan route, as its commands take it: the signed-in person as
 * the actor, and the origin `taskOriginOf` reads off the credential. Use it
 * behind `ApiAuthGuard`, which sets the user.
 */
export const PlanCaller = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): PlanCallerOf => {
    const request = ctx.switchToHttp().getRequest<ScopedRequest>();
    return {
      actor: userActor(String(request.user?.id)),
      origin: taskOriginOf(request.scopeContext ?? null),
    };
  },
);
