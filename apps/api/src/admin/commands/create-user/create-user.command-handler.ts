import { Inject } from '@nestjs/common';
import { CommandHandler, type ICommandHandler } from '@nestjs/cqrs';
import type { AggregateID } from '@oppenheimer/backend-ddd';
import { ADMIN_AUTH } from '../../admin.di-tokens';
import type { AdminAuthPort } from '../../infrastructure/admin-auth.port';
import { CreateUserCommand } from './create-user.command';

@CommandHandler(CreateUserCommand)
export class CreateUserCommandHandler implements ICommandHandler<CreateUserCommand, AggregateID> {
  constructor(
    @Inject(ADMIN_AUTH)
    private readonly admin: AdminAuthPort,
  ) {}

  execute(command: CreateUserCommand): Promise<AggregateID> {
    return this.admin.createUser(command.headers, command.input);
  }
}
