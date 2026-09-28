import { Inject } from '@nestjs/common';
import { CommandHandler, type ICommandHandler } from '@nestjs/cqrs';
import type { AggregateID } from '@oppenheimer/backend-ddd';
import { ADMIN_AUTH } from '../../admin.di-tokens';
import type { AdminAuthPort } from '../../infrastructure/admin-auth.port';
import { AdminUpdateUserCommand } from './admin-update-user.command';

/** Changes an account's profile fields. The password and role have routes of their own. */
@CommandHandler(AdminUpdateUserCommand)
export class AdminUpdateUserCommandHandler
  implements ICommandHandler<AdminUpdateUserCommand, AggregateID>
{
  constructor(
    @Inject(ADMIN_AUTH)
    private readonly admin: AdminAuthPort,
  ) {}

  async execute(command: AdminUpdateUserCommand): Promise<AggregateID> {
    await this.admin.updateUser(command.headers, command.userId, command.data);
    return command.userId;
  }
}
