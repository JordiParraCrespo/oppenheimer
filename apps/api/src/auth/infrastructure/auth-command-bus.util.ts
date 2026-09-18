import { Injectable, Logger, type OnModuleDestroy, type OnModuleInit } from '@nestjs/common';
import { CommandBus } from '@nestjs/cqrs';
import type { CommandBase } from '@oppenheimer/backend-ddd';

const logger = new Logger('AuthHooks');

/**
 * The running application's command bus, or `undefined` outside it.
 *
 * Written by {@link AuthCommandBusBridge} and by nothing else — there is no
 * exported setter, because a public one is an invitation for a second writer
 * and this has exactly one legitimate owner. A short-lived script that imports
 * `auth` (the seed) leaves it unset and does sign-up's side effects itself.
 */
let commandBus: CommandBus | undefined;

/**
 * Run one of the app's use cases from a Better Auth hook.
 *
 * Better Auth is configured at module scope (`better-auth.config.ts`) — it has
 * to be,
 * because the HTTP handler is mounted on the adapter before Nest builds its
 * injector — so its hooks cannot inject anything. That used to mean the work
 * sign-up owes a new account was written where the hook could reach it: raw
 * SQL, in the infrastructure layer, with the product's rules spelled out in
 * `INSERT` statements no domain object knew about. This is the one narrow hole
 * through that wall, and what crosses it is a command object — exactly what a
 * controller would send.
 *
 * Best-effort by design, and the design is Better Auth's: it does not await
 * `databaseHooks.*.after`, so a rejection here would surface as an unhandled
 * rejection rather than as a failed sign-up — and failing the sign-up is the
 * wrong answer anyway. An account whose workspace did not land still exists and
 * can sign in, and provisioning is idempotent, so the seed repairs it. What
 * must not happen is that it fails *quietly*, so every failure is logged with
 * the account it was owed to.
 */
export async function dispatchFromAuthHook(
  command: CommandBase,
  context: { description: string; email: string },
): Promise<void> {
  if (!commandBus) {
    // Not an error: the only processes that configure `auth` without building
    // the injector are scripts, and a script that signs someone up owes itself
    // these side effects (see `database/seed.ts`).
    logger.debug({
      message: `No command bus registered; the caller must ${context.description} itself`,
      email: context.email,
    });
    return;
  }

  try {
    await commandBus.execute(command);
  } catch (error) {
    logger.error(
      { message: `Could not ${context.description}`, email: context.email },
      error instanceof Error ? error.stack : String(error),
    );
  }
}

/**
 * Hands the running application's `CommandBus` to the hooks, and takes it back
 * when the module goes away — otherwise a test that rebuilds the module leaves
 * the variable above pointing at a `CommandBus` whose injector is gone.
 */
@Injectable()
export class AuthCommandBusBridge implements OnModuleInit, OnModuleDestroy {
  constructor(private readonly bus: CommandBus) {}

  onModuleInit(): void {
    commandBus = this.bus;
  }

  onModuleDestroy(): void {
    if (commandBus === this.bus) commandBus = undefined;
  }
}
