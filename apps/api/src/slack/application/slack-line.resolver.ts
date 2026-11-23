import { Inject, Injectable, Logger } from '@nestjs/common';
import type { SlackAccountEntity } from '../domain/slack-account.entity';
import type { SlackSealerPort } from '../infrastructure/slack-sealer.port';
import type { SlackWebApiPort } from '../infrastructure/slack-web-api.port';
import { SLACK_SEALER, SLACK_WEB_API } from '../slack.di-tokens';

/**
 * What the app sends as itself: a fixed line (the owner linked, a turn
 * stopping), never a model's words, and a bot's answer cut into Slack's
 * messages. Both as the bot's app, on its sealed token, counted against the
 * app's bucket.
 */
@Injectable()
export class SlackLineResolver {
  private readonly logger = new Logger(SlackLineResolver.name);

  constructor(
    @Inject(SLACK_SEALER) private readonly sealer: SlackSealerPort,
    @Inject(SLACK_WEB_API) private readonly slack: SlackWebApiPort,
  ) {}

  /** Posts `texts` in order; throws on the first that does not go, having posted those before it. */
  async post(
    account: SlackAccountEntity,
    where: { channel: string; threadTs: string | null },
    texts: readonly string[],
    sent: (count: number) => void = () => {},
  ): Promise<void> {
    const access = {
      botToken: this.sealer.open(account.sealedBotToken),
      bucket: `app:${account.teamId}:${account.botUserId}`,
    };
    let count = 0;
    for (const text of texts) {
      await this.slack.post(access, { ...where, text });
      count += 1;
      sent(count);
    }
  }

  /** A fixed line, not waited on: Slack wants its event answered within three seconds. */
  say(account: SlackAccountEntity, channel: string, threadTs: string | null, text: string): void {
    void this.post(account, { channel, threadTs }, [text]).catch((error: unknown) =>
      this.logger.warn({
        message: 'Could not send a fixed line on Slack',
        accountId: account.id,
        error: error instanceof Error ? error.message : String(error),
      }),
    );
  }
}
