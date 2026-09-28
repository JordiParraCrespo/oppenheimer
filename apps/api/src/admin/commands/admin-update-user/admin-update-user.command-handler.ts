import { Inject } from '@nestjs/common';
import { CommandHandler, type ICommandHandler } from '@nestjs/cqrs';
import { ADMIN_AUTH } from '../../admin.di-tokens';
import type { AdminUserResponseDto } from '../../dtos/admin-user.response.dto';
import type { AdminAuthPort } from '../../infrastructure/admin-auth.port';
import { AdminUpdateUserCommand } from './admin-update-user.command';

/** Changes an account's profile fields. The password and role have routes of their own. */
@CommandHandler(AdminUpdateUserCommand)
export class AdminUpdateUserCommandHandler
  implements ICommandHandler<AdminUpdateUserCommand, AdminUserResponseDto>
{
  constructor(
    @Inject(ADMIN_AUTH)
    private readonly admin: AdminAuthPort,
  ) {}

  execute(command: AdminUpdateUserCommand): Promise<AdminUserResponseDto> {
    return this.admin.updateUser(command.headers, command.userId, command.data);
  }
}
