import { Inject } from '@nestjs/common';
import { CommandHandler, type ICommandHandler } from '@nestjs/cqrs';
import { ADMIN_AUTH } from '../../admin.di-tokens';
import type { AdminUserResponseDto } from '../../dtos/admin-user.response.dto';
import type { AdminAuthPort } from '../../infrastructure/admin-auth.port';
import { UnbanUserCommand } from './unban-user.command';

/** Lifts a ban. */
@CommandHandler(UnbanUserCommand)
export class UnbanUserCommandHandler
  implements ICommandHandler<UnbanUserCommand, AdminUserResponseDto>
{
  constructor(
    @Inject(ADMIN_AUTH)
    private readonly admin: AdminAuthPort,
  ) {}

  execute(command: UnbanUserCommand): Promise<AdminUserResponseDto> {
    return this.admin.unban(command.headers, command.userId);
  }
}
