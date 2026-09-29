import { Inject } from '@nestjs/common';
import { CommandHandler, type ICommandHandler } from '@nestjs/cqrs';
import type { AggregateID } from '@oppenheimer/backend-ddd';
import { ADMIN_AUTH } from '../../admin.di-tokens';
import type { AdminAuthPort } from '../../infrastructure/admin-auth.port';
import { BanUserCommand } from './ban-user.command';

/** Bans an account: its sessions end and it cannot sign in until the ban lapses or is lifted. */
@CommandHandler(BanUserCommand)
export class BanUserCommandHandler implements ICommandHandler<BanUserCommand, AggregateID> {
  constructor(
    @Inject(ADMIN_AUTH)
    private readonly admin: AdminAuthPort,
  ) {}

  async execute(command: BanUserCommand): Promise<AggregateID> {
    await this.admin.ban(command.headers, command.userId, {
      banReason: command.banReason,
      banExpiresIn: command.banExpiresIn,
    });
    return command.userId;
  }
}
