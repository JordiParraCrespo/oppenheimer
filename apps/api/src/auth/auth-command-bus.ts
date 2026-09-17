import { Injectable, Logger, type OnModuleInit } from '@nestjs/common';
import { CommandBus } from '@nestjs/cqrs';
import type { CommandBase } from '@oppenheimer/backend-ddd';

type Dispatch = <T>(command: CommandBase) => Promise<T>;

let dispatch: Dispatch | undefined;

/**
 * The seam between Better Auth and the application's use cases.
 *
 * Better Auth is configured at module scope (`auth.ts`) — it has to be, because
 * the HTTP handler is mounted on the adapter before Nest builds its injector —
 * so its hooks cannot inject anything. That used to mean the work sign-up owes
 * a new account was written where the hook could reach it: raw SQL, in the
 * infrastructure layer, with the product's rules spelled out in `INSERT`
 * statements no domain object knew about.
 *
 * This is the one narrow hole through that wall. The hooks dispatch commands;
 * the handlers are ordinary CQRS handlers in their own modules, with domain
 * entities, repository ports and tests. What crosses the boundary is a command
 * object, which is exactly what a controller would send.
 *
 * `AuthCommandBusBridge` fills it in on module init. Nothing else may.
 */
export function registerAuthCommandDispatch(fn: Dispatch): void {
  dispatch = fn;
}

/**
 * Run one of the app's use cases from a Better Auth hook, without letting a
 * failure reach the caller.
 *
 * Best-effort by design, and the design is Better Auth's: it does not await
 * `databaseHooks.*.after`, so a rejection here would surface as an unhandled
 * rejection rather than as a failed sign-up — and failing the sign-up is the
 * wrong answer anyway. An account whose workspace did not land still exists and
 * can sign in; the console's onboarding screen is the recovery path, and the
 * seed re-runs provisioning. What must not happen is that it fails *quietly*,
 * so every failure is logged with the account it was owed to.
 */
export async function dispatchFromAuthHook(
  command: CommandBase,
  context: { description: string; email: string },
): Promise<void> {
  const logger = new Logger('AuthHooks');
  if (!dispatch) {
    logger.error({
      message: `Could not ${context.description}: the API is not accepting commands yet`,
      email: context.email,
    });
    return;
  }

  try {
    await dispatch(command);
  } catch (error) {
    logger.error(
      { message: `Could not ${context.description}`, email: context.email },
      error instanceof Error ? error.stack : String(error),
    );
  }
}

/** Hands the running application's `CommandBus` to the hooks. */
@Injectable()
export class AuthCommandBusBridge implements OnModuleInit {
  constructor(private readonly commandBus: CommandBus) {}

  onModuleInit(): void {
    registerAuthCommandDispatch((command) => this.commandBus.execute(command));
  }
}
