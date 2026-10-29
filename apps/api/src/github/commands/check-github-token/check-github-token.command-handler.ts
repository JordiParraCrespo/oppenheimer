import { CommandHandler, type ICommandHandler } from '@nestjs/cqrs';
import { GithubTokenResolver } from '../../application/github-token.resolver';
import { CheckGithubTokenCommand } from './check-github-token.command';

@CommandHandler(CheckGithubTokenCommand)
export class CheckGithubTokenCommandHandler
  implements ICommandHandler<CheckGithubTokenCommand, string>
{
  constructor(private readonly tokens: GithubTokenResolver) {}

  async execute(command: CheckGithubTokenCommand): Promise<string> {
    await this.tokens.recheck(command.userId, command.tokenId, new Date());
    return command.tokenId;
  }
}
