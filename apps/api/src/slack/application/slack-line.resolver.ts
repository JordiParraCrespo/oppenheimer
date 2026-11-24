import { Inject, Injectable, Logger } from '@nestjs/common';
import type { SlackAccountEntity } from '../domain/slack-account.entity';
import type { SlackSealerPort } from '../infrastructure/slack-sealer.port';
import type { SlackAppAccess, SlackWebApiPort } from '../infrastructure/slack-web-api.port';
import { SLACK_SEALER, SLACK_WEB_API } from '../slack.di-tokens';

/** The reaction on the owner's message while the bot works on it: seen, and on it. */
export const SLACK_WORKING_REACTION = 'eyes';

/** How long an event waits for the names its mentions are read by, all lookups together. */
export const SLACK_NAMES_DEADLINE_MS = 1_500;

/**
 * What the app sends as itself: a fixed line (the owner linked, a turn
 * stopping), never a model's words, a bot's answer cut into Slack's
 * messages, the reaction that says it is working, and the names it reads
 * mentions by. All as the bot's app, on its sealed token, counted against
 * the app's bucket.
 */
@Injectable()
export class SlackLineResolver {
  private readonly logger = new Logger(SlackLineResolver.name);

  constructor(
    @Inject(SLACK_SEALER) private readonly sealer: SlackSealerPort,
    @Inject(SLACK_WEB_API) private readonly slack: SlackWebApiPort,
  ) {}

  private access(account: SlackAccountEntity): SlackAppAccess {
    return {
      botToken: this.sealer.open(account.sealedBotToken),
      bucket: `app:${account.teamId}:${account.botUserId}`,
    };
  }

  /** Posts `texts` in order; throws on the first that does not go, having posted those before it. */
  async post(
    account: SlackAccountEntity,
    where: { channel: string; threadTs: string | null },
    texts: readonly string[],
    sent: (count: number) => void = () => {},
  ): Promise<void> {
    const access = this.access(account);
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

  /**
   * The names of the people in `userIds`, as far as Slack answers within
   * `SLACK_NAMES_DEADLINE_MS` all told: a lookup that fails or is late (an
   * app made before it asked for `users:read`, Slack slow, the limiter
   * queueing) leaves that person out, so the bot reads their id, and never
   * fails or holds up the event it is for past Slack's three seconds.
   */
  async namesOf(
    account: SlackAccountEntity,
    userIds: readonly string[],
  ): Promise<Map<string, string>> {
    const names = new Map<string, string>();
    if (userIds.length === 0) return names;
    const access = this.access(account);
    const lookups = Promise.all(
      userIds.map(async (userId) => {
        const name = await this.slack.userName(access, userId).catch(() => null);
        if (name) names.set(userId, name);
      }),
    );
    let timer: NodeJS.Timeout | undefined;
    const deadline = new Promise<void>((resolve) => {
      timer = setTimeout(resolve, SLACK_NAMES_DEADLINE_MS);
    });
    await Promise.race([lookups, deadline]).finally(() => clearTimeout(timer));
    return new Map(names);
  }

  /**
   * Puts the working reaction on the owner's message (`on`), or takes it off
   * once its answer went, not waited on. One that does not go (an app made
   * before it asked for `reactions:write`, the message deleted) changes
   * nothing else: the answer is what matters.
   */
  working(
    account: SlackAccountEntity,
    message: { channel: string; ts: string },
    on: boolean,
  ): void {
    void this.slack
      .react(this.access(account), { ...message, name: SLACK_WORKING_REACTION }, on)
      .catch((error: unknown) =>
        this.logger.debug({
          message: 'Could not change the working reaction on Slack',
          accountId: account.id,
          error: error instanceof Error ? error.message : String(error),
        }),
      );
  }

  /** A file the owner shared, fetched as the bot's app; throws as the download does. */
  file(account: SlackAccountEntity, url: string, maxBytes: number): Promise<Buffer> {
    return this.slack.download(this.access(account), url, maxBytes);
  }
}
