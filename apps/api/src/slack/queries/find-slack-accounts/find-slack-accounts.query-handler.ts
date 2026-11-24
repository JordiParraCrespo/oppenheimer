import { Inject } from '@nestjs/common';
import { type IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import type { SlackAccountRepositoryPort } from '../../database/slack-account.repository.port';
import type { SlackAccountResponseDto } from '../../dtos/slack-account.response.dto';
import { SLACK_ACCOUNT_REPOSITORY } from '../../slack.di-tokens';
import { SlackAccountMapper } from '../../slack-account.mapper';
import { FindSlackAccountsQuery } from './find-slack-accounts.query';

/** The caller's own bots' Slack apps, oldest first. */
@QueryHandler(FindSlackAccountsQuery)
export class FindSlackAccountsQueryHandler
  implements IQueryHandler<FindSlackAccountsQuery, SlackAccountResponseDto[]>
{
  constructor(
    @Inject(SLACK_ACCOUNT_REPOSITORY) private readonly accounts: SlackAccountRepositoryPort,
    private readonly mapper: SlackAccountMapper,
  ) {}

  async execute({ scope }: FindSlackAccountsQuery): Promise<SlackAccountResponseDto[]> {
    const accounts = await this.accounts.findAllOwn(scope);
    return accounts.map((account) => this.mapper.toResponse(account));
  }
}
