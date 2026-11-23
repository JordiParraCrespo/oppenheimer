import { Inject } from '@nestjs/common';
import { CommandHandler, type ICommandHandler } from '@nestjs/cqrs';
import { AppError } from '@oppenheimer/backend-core';
import { SlackLineResolver } from '../../application/slack-line.resolver';
import type { SlackAccountRepositoryPort } from '../../database/slack-account.repository.port';
import { SlackOwnerWroteDomainEvent } from '../../domain/events/slack-owner-wrote.domain-event';
import { SlackErrors } from '../../domain/slack.errors';
import type { SlackAccountEntity } from '../../domain/slack-account.entity';
import { hashSlackOwnerCode } from '../../domain/slack-account.entity';
import {
  SLACK_LINKED_LINE,
  SLACK_STOP_LINE,
  type SlackEvent,
  type SlackInboundAction,
  slackInboundAction,
  slackTsPosition,
} from '../../domain/slack-inbound.policy';
import { isSlackSigned } from '../../domain/slack-signature.policy';
import { slackChatIdOf } from '../../domain/slack-text.policy';
import type { SlackSealerPort } from '../../infrastructure/slack-sealer.port';
import { SLACK_ACCOUNT_REPOSITORY, SLACK_SEALER } from '../../slack.di-tokens';
import { type ReceivedSlackEvent, ReceiveSlackEventCommand } from './receive-slack-event.command';

/**
 * One request to a bot's events address. Nothing in it is acted on before its
 * signature is checked against the app's signing secret, except Slack's
 * `url_verification`: Slack sends it when the app is created, before the
 * person has a secret to paste (or while the bot still has an older app's),
 * and the answer only echoes its challenge. A request signed wrong is refused
 * (`SLACK_008`); one for a bot with no app connected is answered with nothing.
 *
 * An event from the app's workspace is acted on (`slackInboundAction`): the
 * owner's message wakes the bot through `SlackOwnerWroteDomainEvent`, a `link`
 * code records the owner, and anyone else is ignored. Slack wants an answer
 * within three seconds, so the lines the app sends back are not waited on.
 */
@CommandHandler(ReceiveSlackEventCommand)
export class ReceiveSlackEventCommandHandler
  implements ICommandHandler<ReceiveSlackEventCommand, ReceivedSlackEvent>
{
  constructor(
    @Inject(SLACK_ACCOUNT_REPOSITORY) private readonly accounts: SlackAccountRepositoryPort,
    @Inject(SLACK_SEALER) private readonly sealer: SlackSealerPort,
    private readonly lines: SlackLineResolver,
  ) {}

  async execute(command: ReceiveSlackEventCommand): Promise<ReceivedSlackEvent> {
    const payload = parse(command.body);
    if (payload.type === 'url_verification') return challengeOf(payload);
    const found = await this.accounts.findByBotForSystem(command.botId);
    if (found.isNone()) return {};
    const account = found.unwrap();
    const secret = this.sealer.open(account.sealedSigningSecret);
    if (!isSlackSigned(secret, command, new Date())) {
      throw new AppError(SlackErrors.SIGNATURE_INVALID, { extensions: { botId: command.botId } });
    }
    if (payload.type !== 'event_callback' || payload.team_id !== account.teamId) return {};
    const event = (payload.event ?? {}) as SlackEvent;
    await this.act(account, slackInboundAction(account, event), command.metadata.correlationId);
    return {};
  }

  private async act(
    account: SlackAccountEntity,
    action: SlackInboundAction,
    correlationId: string | undefined,
  ): Promise<void> {
    if (action.kind === 'link') {
      const usedCodeHash = hashSlackOwnerCode(action.code);
      if (!account.claimOwner(action.code, action.user, new Date())) return;
      if (!(await this.accounts.saveOwner(account, usedCodeHash))) return;
      this.lines.say(account, action.channel, null, SLACK_LINKED_LINE);
      return;
    }
    const position = action.kind === 'owner' ? slackTsPosition(action.ts) : null;
    if (action.kind !== 'owner' || !position || !account.isConnected) return;
    await this.accounts.publish([
      new SlackOwnerWroteDomainEvent({
        aggregateId: account.id,
        reason: `the owner of bot ${account.botId}'s Slack app asked it (${action.command})`,
        metadata: { correlationId },
        organizationId: account.organizationId,
        userId: account.userId,
        botId: account.botId,
        channel: action.channel,
        chatId: slackChatIdOf(action.channel, action.threadTs),
        ts: action.ts,
        position,
        command: action.command,
        text: action.command === 'stop' ? '' : action.text,
      }),
    ]);
    if (action.command === 'stop')
      this.lines.say(account, action.channel, action.threadTs, SLACK_STOP_LINE);
  }
}

function parse(body: Buffer): Record<string, unknown> {
  try {
    const value: unknown = JSON.parse(body.toString('utf8'));
    return value !== null && typeof value === 'object' ? (value as Record<string, unknown>) : {};
  } catch {
    return {};
  }
}

function challengeOf(payload: Record<string, unknown>): ReceivedSlackEvent {
  return payload.type === 'url_verification' && typeof payload.challenge === 'string'
    ? { challenge: payload.challenge.slice(0, 200) }
    : {};
}
