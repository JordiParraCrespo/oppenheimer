import { CommandHandler, type ICommandHandler } from '@nestjs/cqrs';
import { GithubTokenResolver } from '../../application/github-token.resolver';
import { PinGithubTokenCommand } from './pin-github-token.command';

@CommandHandler(PinGithubTokenCommand)
export class PinGithubTokenCommandHandler implements ICommandHandler<PinGithubTokenCommand, void> {
  constructor(private readonly tokens: GithubTokenResolver) {}

  async execute(command: PinGithubTokenCommand): Promise<void> {
    await this.tokens.pin(command.userId, command.githubRepoId, command.tokenId);
  }
}
