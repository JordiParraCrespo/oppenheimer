import { CommandHandler, type ICommandHandler } from '@nestjs/cqrs';
import { GithubTokenResolver } from '../../application/github-token.resolver';
import { RenameGithubTokenCommand } from './rename-github-token.command';

@CommandHandler(RenameGithubTokenCommand)
export class RenameGithubTokenCommandHandler
  implements ICommandHandler<RenameGithubTokenCommand, string>
{
  constructor(private readonly tokens: GithubTokenResolver) {}

  async execute(command: RenameGithubTokenCommand): Promise<string> {
    await this.tokens.relabel(command.userId, command.tokenId, command.label);
    return command.tokenId;
  }
}
