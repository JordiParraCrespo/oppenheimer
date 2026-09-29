import { Inject } from '@nestjs/common';
import { CommandHandler, type ICommandHandler } from '@nestjs/cqrs';
import { ADMIN_AUTH } from '../../admin.di-tokens';
import type { AdminSuccessResponseDto } from '../../dtos/admin-user.response.dto';
import type { AdminAuthPort } from '../../infrastructure/admin-auth.port';
import { SetUserPasswordCommand } from './set-user-password.command';

/** Sets an account's password without knowing the current one. */
@CommandHandler(SetUserPasswordCommand)
export class SetUserPasswordCommandHandler
  implements ICommandHandler<SetUserPasswordCommand, AdminSuccessResponseDto>
{
  constructor(
    @Inject(ADMIN_AUTH)
    private readonly admin: AdminAuthPort,
  ) {}

  execute(command: SetUserPasswordCommand): Promise<AdminSuccessResponseDto> {
    return this.admin.setPassword(command.headers, command.userId, command.newPassword);
  }
}
