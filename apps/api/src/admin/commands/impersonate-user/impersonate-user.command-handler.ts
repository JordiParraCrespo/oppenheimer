import { Inject } from '@nestjs/common';
import { CommandHandler, type ICommandHandler } from '@nestjs/cqrs';
import { ADMIN_AUTH } from '../../admin.di-tokens';
import type { AdminAuthPort } from '../../infrastructure/admin-auth.port';
import { ImpersonateUserCommand } from './impersonate-user.command';

/** Starts acting as another account. Resolves to the cookies of the impersonation session —
 * about this request, so they ride back on the command; the user is read with a query. */
@CommandHandler(ImpersonateUserCommand)
export class ImpersonateUserCommandHandler
  implements ICommandHandler<ImpersonateUserCommand, string[]>
{
  constructor(
    @Inject(ADMIN_AUTH)
    private readonly admin: AdminAuthPort,
  ) {}

  execute(command: ImpersonateUserCommand): Promise<string[]> {
    return this.admin.impersonate(command.headers, command.userId);
  }
}
