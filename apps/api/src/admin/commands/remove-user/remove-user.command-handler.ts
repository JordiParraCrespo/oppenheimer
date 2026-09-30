import { Inject } from '@nestjs/common';
import { CommandHandler, type ICommandHandler } from '@nestjs/cqrs';
import { ADMIN_AUTH } from '../../admin.di-tokens';
import type { AdminSuccessResponseDto } from '../../dtos/admin-user.response.dto';
import type { AdminAuthPort } from '../../infrastructure/admin-auth.port';
import { RemoveUserCommand } from './remove-user.command';

@CommandHandler(RemoveUserCommand)
export class RemoveUserCommandHandler
  implements ICommandHandler<RemoveUserCommand, AdminSuccessResponseDto>
{
  constructor(
    @Inject(ADMIN_AUTH)
    private readonly admin: AdminAuthPort,
  ) {}

  execute(command: RemoveUserCommand): Promise<AdminSuccessResponseDto> {
    return this.admin.remove(command.headers, command.userId);
  }
}
