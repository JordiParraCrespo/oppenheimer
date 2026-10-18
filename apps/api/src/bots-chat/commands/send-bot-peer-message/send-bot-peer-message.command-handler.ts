import { Inject } from '@nestjs/common';
import { CommandHandler, type ICommandHandler } from '@nestjs/cqrs';
import { BOT_PROVIDER_CATALOG, botDefaultModel } from '@oppenheimer/shared';
import type { BotLookupPort } from '../../../bots/application/bot-lookup.port';
import { BOT_LOOKUP, MODEL_PROVIDER_CREDENTIAL_REPOSITORY } from '../../../bots/bots.di-tokens';
import type { ModelProviderCredentialRepositoryPort } from '../../../bots/database/model-provider-credential.repository.port';
import { BOT_STREAM, BOT_TURN_REPOSITORY } from '../../bots-chat.di-tokens';
import type { BotTurnRepositoryPort } from '../../database/bot-turn.repository.port';
import { checkBotChain } from '../../domain/bot-chain.policy';
import { BotMessageEntity } from '../../domain/bot-message.entity';
import { secretIn, secretRefusal } from '../../domain/bot-peer-message.policy';
import { BotTurnEntity } from '../../domain/bot-turn.entity';
import type { BotStreamPort } from '../../infrastructure/bot-stream.port';
import {
  SendBotPeerMessageCommand,
  type SendBotPeerMessageResult,
} from './send-bot-peer-message.command';

/**
 * One bot messages another (`25-bots.md` §4.6), with what the experiments in
 * `research/agent-coordination-experiments.md` showed agents must not be
 * left to agree among themselves:
 *
 * - **The sender is recorded, not claimed.** The message carries the bot of
 *   the turn that made the call, read here, and the event names it.
 * - **No credential travels.** A message holding one is refused, unsent.
 * - **The chain is bounded** (`BotChainPolicy`), decided under the chain's
 *   lock: no bot asks itself, no chain goes past its depth or its budget, and
 *   no bot already in the chain is asked again.
 * - **Delivery is a turn, not an interruption.** The message opens a queued
 *   turn in the receiving bot's `bots` lane, after your messages, on its own
 *   engine, with no more reach than the asking turn: the same sender, zone
 *   and credential scopes, and the receiving bot's own permission.
 *
 * A refusal is the sending bot's to read, as its tool's answer.
 */
@CommandHandler(SendBotPeerMessageCommand)
export class SendBotPeerMessageCommandHandler
  implements ICommandHandler<SendBotPeerMessageCommand, SendBotPeerMessageResult>
{
  constructor(
    @Inject(BOT_LOOKUP) private readonly lookup: BotLookupPort,
    @Inject(MODEL_PROVIDER_CREDENTIAL_REPOSITORY)
    private readonly credentials: ModelProviderCredentialRepositoryPort,
    @Inject(BOT_TURN_REPOSITORY) private readonly turns: BotTurnRepositoryPort,
    @Inject(BOT_STREAM) private readonly stream: BotStreamPort,
  ) {}

  async execute(command: SendBotPeerMessageCommand): Promise<SendBotPeerMessageResult> {
    const { owner, organizationId, fromTurnId, fromBotId, toBotId, content } = command;
    const asking = await this.askingTurn(organizationId, fromBotId, fromTurnId);
    if (!asking) return refused('This turn is no longer running, so it can send nothing.');
    const secret = secretIn(content);
    if (secret) return refused(secretRefusal(secret));

    const [sender, target] = await Promise.all([
      this.lookup.bot(owner, fromBotId),
      this.lookup.bot(owner, toBotId),
    ]);
    if ((await this.credentials.findOne(owner, target.provider)).isNone()) {
      const label = BOT_PROVIDER_CATALOG[target.provider].label;
      return refused(
        `${target.name} runs on ${label}, and the workspace has no ${label} key, so it could not answer. Tell the person; they can add the key in Settings → Model providers.`,
      );
    }
    if (!asking.requestedByUserId) {
      return refused('The person this request came from no longer has an account.');
    }

    const turn = BotTurnEntity.queueFromBot(asking, {
      botId: target.id,
      provider: target.provider,
      model: target.model ?? botDefaultModel(target.provider).id,
      effort: target.effort,
      replyRequested: command.expectsReply,
    });
    const message = BotMessageEntity.createNew({
      organizationId,
      botId: target.id,
      turnId: turn.id,
      role: 'event',
      content,
      steps: [],
      position: 0,
      event: {
        kind: 'bot_message',
        fromBotId: sender.id,
        fromBotName: sender.name,
        expectsReply: command.expectsReply,
      },
    });
    const queued = await this.turns.enqueueFromBot(
      turn,
      message,
      command.metadata.correlationId,
      (state) => checkBotChain(asking, target.id, state),
    );
    if (queued.outcome === 'refused') return refused(queued.refusal);
    if (queued.outcome === 'chain_gone') {
      return refused(
        'The request this belongs to was cleared from the chat it started in, so no more bots are messaged for it.',
      );
    }
    if (queued.outcome === 'missing') return refused(`${target.name} was deleted.`);
    await this.stream.publish(target.id, { type: 'turn', turnId: turn.id, status: 'queued' });
    return { sent: true, turnId: turn.id, botName: target.name };
  }

  /** The turn that made the call, when it is that bot's and still running. */
  private async askingTurn(
    organizationId: string,
    botId: string,
    turnId: string,
  ): Promise<BotTurnEntity | null> {
    const found = await this.turns.findForRun(turnId);
    if (found.isNone()) return null;
    const turn = found.unwrap();
    const ours = turn.organizationId === organizationId && turn.botId === botId;
    return ours && turn.status === 'running' ? turn : null;
  }
}

function refused(refusal: string): SendBotPeerMessageResult {
  return { sent: false, refusal };
}
