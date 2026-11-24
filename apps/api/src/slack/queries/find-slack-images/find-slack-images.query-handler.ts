import { Inject, Logger } from '@nestjs/common';
import { type IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { SlackLineResolver } from '../../application/slack-line.resolver';
import type { SlackAccountRepositoryPort } from '../../database/slack-account.repository.port';
import { SLACK_ACCOUNT_REPOSITORY } from '../../slack.di-tokens';
import { FindSlackImagesQuery, type SlackImageFetched } from './find-slack-images.query';

/**
 * Fetches the owner's shared images, together, as the bot's app while it is
 * connected and still this bot's; none otherwise. An image that does not come
 * (an app made before it asked for `files:read`, deleted, too large, Slack
 * down) is left out, so the owner's words still reach the bot, and the
 * answer says how many were fetched in order of the message.
 */
@QueryHandler(FindSlackImagesQuery)
export class FindSlackImagesQueryHandler
  implements IQueryHandler<FindSlackImagesQuery, SlackImageFetched[]>
{
  private readonly logger = new Logger(FindSlackImagesQueryHandler.name);

  constructor(
    @Inject(SLACK_ACCOUNT_REPOSITORY) private readonly accounts: SlackAccountRepositoryPort,
    private readonly lines: SlackLineResolver,
  ) {}

  async execute(query: FindSlackImagesQuery): Promise<SlackImageFetched[]> {
    if (query.images.length === 0) return [];
    const found = await this.accounts.findByIdForSystem(query.organizationId, query.accountId);
    if (found.isNone()) return [];
    const account = found.unwrap();
    if (!account.isConnected || account.botId !== query.botId) return [];
    const fetched = await Promise.all(
      query.images.map(async (image) => {
        try {
          const bytes = await this.lines.file(account, image.url, query.maxBytes);
          return { name: image.name, bytes };
        } catch (error) {
          this.logger.warn({
            message: 'Could not fetch an image shared on Slack',
            accountId: account.id,
            fileId: image.id,
            error: error instanceof Error ? error.message : String(error),
          });
          return null;
        }
      }),
    );
    return fetched.filter((image): image is SlackImageFetched => image !== null);
  }
}
