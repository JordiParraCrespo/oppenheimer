import { Inject } from '@nestjs/common';
import { CommandHandler, type ICommandHandler } from '@nestjs/cqrs';
import { ADMIN_AUTH } from '../../admin.di-tokens';
import type { AdminAuthPort, IssuedSession } from '../../infrastructure/admin-auth.port';
import { ImpersonateUserCommand } from './impersonate-user.command';

/** Starts acting as another account, on an impersonation session issued for the caller. */
@CommandHandler(ImpersonateUserCommand)
export class ImpersonateUserCommandHandler
  implements ICommandHandler<ImpersonateUserCommand, IssuedSession>
{
  constructor(
    @Inject(ADMIN_AUTH)
    private readonly admin: AdminAuthPort,
  ) {}

  execute(command: ImpersonateUserCommand): Promise<IssuedSession> {
    return this.admin.impersonate(command.headers, command.userId);
  }
}
