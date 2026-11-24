import { Inject } from '@nestjs/common';
import { type IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { AppError } from '@oppenheimer/backend-core';
import type { SlackAccountRepositoryPort } from '../../database/slack-account.repository.port';
import { SlackErrors } from '../../domain/slack.errors';
import type { SlackAccountResponseDto } from '../../dtos/slack-account.response.dto';
import { SLACK_ACCOUNT_REPOSITORY } from '../../slack.di-tokens';
import { SlackAccountMapper } from '../../slack-account.mapper';
import { FindSlackAccountQuery } from './find-slack-account.query';

/** One of the caller's own Slack apps; the connect route reads its answer back through it. */
@QueryHandler(FindSlackAccountQuery)
export class FindSlackAccountQueryHandler
  implements IQueryHandler<FindSlackAccountQuery, SlackAccountResponseDto>
{
  constructor(
    @Inject(SLACK_ACCOUNT_REPOSITORY) private readonly accounts: SlackAccountRepositoryPort,
    private readonly mapper: SlackAccountMapper,
  ) {}

  async execute({ scope, accountId }: FindSlackAccountQuery): Promise<SlackAccountResponseDto> {
    const found = await this.accounts.findOwnById(scope, accountId);
    if (found.isNone()) {
      throw new AppError(SlackErrors.ACCOUNT_NOT_FOUND, { extensions: { accountId } });
    }
    return this.mapper.toResponse(found.unwrap());
  }
}
