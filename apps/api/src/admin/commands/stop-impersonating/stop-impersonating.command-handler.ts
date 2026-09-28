import { Inject } from '@nestjs/common';
import { CommandHandler, type ICommandHandler } from '@nestjs/cqrs';
import { ADMIN_AUTH } from '../../admin.di-tokens';
import type { AdminAuthPort, IssuedSession } from '../../infrastructure/admin-auth.port';
import { StopImpersonatingCommand } from './stop-impersonating.command';

/** Ends the caller's impersonation and puts them back on their own session. */
@CommandHandler(StopImpersonatingCommand)
export class StopImpersonatingCommandHandler
  implements ICommandHandler<StopImpersonatingCommand, IssuedSession>
{
  constructor(
    @Inject(ADMIN_AUTH)
    private readonly admin: AdminAuthPort,
  ) {}

  execute(command: StopImpersonatingCommand): Promise<IssuedSession> {
    return this.admin.stopImpersonating(command.headers);
  }
}
