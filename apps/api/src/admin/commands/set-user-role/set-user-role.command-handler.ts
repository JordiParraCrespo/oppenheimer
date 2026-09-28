import { Inject } from '@nestjs/common';
import { CommandHandler, type ICommandHandler } from '@nestjs/cqrs';
import type { AggregateID } from '@oppenheimer/backend-ddd';
import { ADMIN_AUTH } from '../../admin.di-tokens';
import type { AdminAuthPort } from '../../infrastructure/admin-auth.port';
import { SetUserRoleCommand } from './set-user-role.command';

/** Replaces an account's global role. */
@CommandHandler(SetUserRoleCommand)
export class SetUserRoleCommandHandler implements ICommandHandler<SetUserRoleCommand, AggregateID> {
  constructor(
    @Inject(ADMIN_AUTH)
    private readonly admin: AdminAuthPort,
  ) {}

  async execute(command: SetUserRoleCommand): Promise<AggregateID> {
    await this.admin.setRole(command.headers, command.userId, command.role);
    return command.userId;
  }
}
