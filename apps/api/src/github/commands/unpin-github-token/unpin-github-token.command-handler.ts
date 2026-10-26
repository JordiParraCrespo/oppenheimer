import { CommandHandler, type ICommandHandler } from '@nestjs/cqrs';
import { GithubTokenResolver } from '../../application/github-token.resolver';
import { UnpinGithubTokenCommand } from './unpin-github-token.command';

@CommandHandler(UnpinGithubTokenCommand)
export class UnpinGithubTokenCommandHandler
  implements ICommandHandler<UnpinGithubTokenCommand, void>
{
  constructor(private readonly tokens: GithubTokenResolver) {}

  async execute(command: UnpinGithubTokenCommand): Promise<void> {
    await this.tokens.unpin(command.userId, command.githubRepoId);
  }
}
