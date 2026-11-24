import { Inject } from '@nestjs/common';
import { CommandHandler, type ICommandHandler } from '@nestjs/cqrs';
import { AppError } from '@oppenheimer/backend-core';
import { redactSecrets } from '../../../sessions/domain/session-transcript.policy';
import { SlackLineResolver } from '../../application/slack-line.resolver';
import type { SlackAccountRepositoryPort } from '../../database/slack-account.repository.port';
import { SlackErrors } from '../../domain/slack.errors';
import { slackMessages, slackMrkdwn, slackThreadOf } from '../../domain/slack-text.policy';
import { SLACK_ACCOUNT_REPOSITORY } from '../../slack.di-tokens';
import { ReplyOnSlackCommand } from './reply-on-slack.command';

/**
 * Sends a bot's answer in the thread it was asked in, in Slack's markdown and
 * cut to Slack's length, while the app is connected and still this bot's.
 * Everyone in a channel reads its threads, so a secret in the words (a token,
 * a key, a password as the session transcript finds them) goes as
 * `[redacted]`; the console keeps the words as written. The turn's last
 * answer takes the working reaction off the message it answers. Otherwise
 * nothing goes (it was disconnected while the turn ran). A token
 * Slack refuses marks the app `revoked`, so its settings say why the bot went
 * quiet. Answers how many messages went.
 */
@CommandHandler(ReplyOnSlackCommand)
export class ReplyOnSlackCommandHandler implements ICommandHandler<ReplyOnSlackCommand, number> {
  constructor(
    @Inject(SLACK_ACCOUNT_REPOSITORY) private readonly accounts: SlackAccountRepositoryPort,
    private readonly lines: SlackLineResolver,
  ) {}

  async execute(command: ReplyOnSlackCommand): Promise<number> {
    const found = await this.accounts.findByIdForSystem(command.organizationId, command.accountId);
    const thread = slackThreadOf(command.chatId);
    if (found.isNone() || !thread) return 0;
    const account = found.unwrap();
    if (!account.isConnected || account.botId !== command.botId) return 0;
    let sent = 0;
    try {
      const { text } = redactSecrets(command.text);
      await this.lines.post(account, thread, slackMessages(slackMrkdwn(text)), (count) => {
        sent = count;
      });
      if (command.endsTs) {
        this.lines.working(account, { channel: thread.channel, ts: command.endsTs }, false);
      }
    } catch (error) {
      if (error instanceof AppError && error.code === SlackErrors.TOKEN_REFUSED.code) {
        account.revoke(error.detail ?? SlackErrors.TOKEN_REFUSED.message);
        await this.accounts.saveStatus(account);
      }
      if (sent === 0) throw error;
    }
    return sent;
  }
}
