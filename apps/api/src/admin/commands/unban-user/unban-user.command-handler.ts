import { Inject } from '@nestjs/common';
import { CommandHandler, type ICommandHandler } from '@nestjs/cqrs';
import type { AggregateID } from '@oppenheimer/backend-ddd';
import { ADMIN_AUTH } from '../../admin.di-tokens';
import type { AdminAuthPort } from '../../infrastructure/admin-auth.port';
import { UnbanUserCommand } from './unban-user.command';

@CommandHandler(UnbanUserCommand)
export class UnbanUserCommandHandler implements ICommandHandler<UnbanUserCommand, AggregateID> {
  constructor(
    @Inject(ADMIN_AUTH)
    private readonly admin: AdminAuthPort,
  ) {}

  async execute(command: UnbanUserCommand): Promise<AggregateID> {
    await this.admin.unban(command.headers, command.userId);
    return command.userId;
  }
}
