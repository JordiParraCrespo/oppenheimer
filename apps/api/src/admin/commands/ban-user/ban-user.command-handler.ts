import { Inject } from '@nestjs/common';
import { CommandHandler, type ICommandHandler } from '@nestjs/cqrs';
import { ADMIN_AUTH } from '../../admin.di-tokens';
import type { AdminUserResponseDto } from '../../dtos/admin-user.response.dto';
import type { AdminAuthPort } from '../../infrastructure/admin-auth.port';
import { BanUserCommand } from './ban-user.command';

/** Bans an account: its sessions end and it cannot sign in until the ban lapses or is lifted. */
@CommandHandler(BanUserCommand)
export class BanUserCommandHandler
  implements ICommandHandler<BanUserCommand, AdminUserResponseDto>
{
  constructor(
    @Inject(ADMIN_AUTH)
    private readonly admin: AdminAuthPort,
  ) {}

  execute(command: BanUserCommand): Promise<AdminUserResponseDto> {
    return this.admin.ban(command.headers, command.userId, {
      banReason: command.banReason,
      banExpiresIn: command.banExpiresIn,
    });
  }
}
