import { Inject } from '@nestjs/common';
import { CommandHandler, type ICommandHandler } from '@nestjs/cqrs';
import { ADMIN_AUTH } from '../../admin.di-tokens';
import type { AdminUserResponseDto } from '../../dtos/admin-user.response.dto';
import type { AdminAuthPort } from '../../infrastructure/admin-auth.port';
import { SetUserRoleCommand } from './set-user-role.command';

/** Replaces an account's global role. */
@CommandHandler(SetUserRoleCommand)
export class SetUserRoleCommandHandler
  implements ICommandHandler<SetUserRoleCommand, AdminUserResponseDto>
{
  constructor(
    @Inject(ADMIN_AUTH)
    private readonly admin: AdminAuthPort,
  ) {}

  execute(command: SetUserRoleCommand): Promise<AdminUserResponseDto> {
    return this.admin.setRole(command.headers, command.userId, command.role);
  }
}
