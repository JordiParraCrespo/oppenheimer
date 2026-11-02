import { CommandHandler, type ICommandHandler } from '@nestjs/cqrs';
import { GithubTokenResolver } from '../../application/github-token.resolver';
import { RemoveGithubTokenCommand } from './remove-github-token.command';

@CommandHandler(RemoveGithubTokenCommand)
export class RemoveGithubTokenCommandHandler
  implements ICommandHandler<RemoveGithubTokenCommand, void>
{
  constructor(private readonly tokens: GithubTokenResolver) {}

  async execute(command: RemoveGithubTokenCommand): Promise<void> {
    await this.tokens.remove(command.userId, command.tokenId);
  }
}
