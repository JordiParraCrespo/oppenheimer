import { CommandBus, CommandHandler, type ICommandHandler } from '@nestjs/cqrs';
import { ProvisionPersonalWorkspaceCommand } from '../../../organizations/commands/provision-personal-workspace/provision-personal-workspace.command';
import { AssignDefaultRoleCommand } from '../../../roles/commands/assign-default-role/assign-default-role.command';
import { CompleteSignUpCommand } from './complete-sign-up.command';

/**
 * What a new account is owed, in the order it is owed.
 *
 * The default `user` role first: it is where the account's permissions are
 * read from, and a workspace it has no permission to open is the failure this
 * whole arrangement exists to avoid. Then the personal workspace itself.
 *
 * This is the only place that knows sign-up is fulfilled by the roles and
 * organizations modules. A handler can inject `CommandBus`; the hook that
 * raises the command cannot inject anything, which is the whole reason the
 * orchestration lives here rather than there.
 */
@CommandHandler(CompleteSignUpCommand)
export class CompleteSignUpService implements ICommandHandler<CompleteSignUpCommand, void> {
  constructor(private readonly commandBus: CommandBus) {}

  async execute(command: CompleteSignUpCommand): Promise<void> {
    await this.commandBus.execute(new AssignDefaultRoleCommand({ userId: command.userId }));
    await this.commandBus.execute(
      new ProvisionPersonalWorkspaceCommand({
        userId: command.userId,
        email: command.email,
        name: command.name,
      }),
    );
  }
}
