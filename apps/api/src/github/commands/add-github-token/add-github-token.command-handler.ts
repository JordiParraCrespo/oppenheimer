import { CommandHandler, type ICommandHandler } from '@nestjs/cqrs';
import { GithubTokenResolver } from '../../application/github-token.resolver';
import { AddGithubTokenCommand } from './add-github-token.command';

@CommandHandler(AddGithubTokenCommand)
export class AddGithubTokenCommandHandler
  implements ICommandHandler<AddGithubTokenCommand, string>
{
  constructor(private readonly tokens: GithubTokenResolver) {}

  async execute(command: AddGithubTokenCommand): Promise<string> {
    return this.tokens.add(command.userId, command.label, command.token, new Date());
  }
}
