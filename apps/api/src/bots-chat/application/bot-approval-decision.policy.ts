import {
  BOT_TOOL_GRANTS_MAX,
  type BotApprovalDecision,
  botDefaultModel,
  type Scope,
} from '@oppenheimer/shared';
import type { BotEntity } from '../../bots/domain/bot.entity';
import type { BotApprovalEffects } from '../database/bot-approval.repository.port';
import type { BotApprovalEntity } from '../domain/bot-approval.entity';
import { decisionTurn, intersectScopes, reachOf, stoppedLine } from '../domain/bot-approval.policy';
import type { BotTurnEntity } from '../domain/bot-turn.entity';

/** Who decides, and through what. */
export interface BotApprovalDecider {
  userId: string;
  /** Their name, as the bot is told. */
  name: string;
  /** The deciding credential's scopes; null for a browser session. */
  scopes: readonly Scope[] | null;
  note: string | null;
}

/** What a decision owes beyond the approval's own move. */
export interface BotApprovalOutcome {
  /** What is written with the decision, in its transaction. */
  effects: BotApprovalEffects;
  /** The asking turn is still running and the decision stops it. */
  cancelAsking: boolean;
}

/**
 * Applies one of a card's decisions to it and says what that owes
 * (`25-bots.md` §5): a yes moves the card, stages the call, with the
 * permission it leaves standing when it reaches past this call, and queues
 * the turn where the bot says it is on it while the call runs, so you hear
 * back at once rather than after the call; a no queues the turn that tells
 * the bot, so it carries on; both turns run under what both the asking
 * turn's and the decider's scopes cover. A stop writes its line outside any
 * turn, queues none, and stops the asking turn if it still runs. The
 * decision is one the card offers; the handler checks that first.
 */
export function decideApproval(
  approval: BotApprovalEntity,
  decision: BotApprovalDecision,
  decider: BotApprovalDecider,
  context: {
    bot: Pick<BotEntity, 'id' | 'organizationId' | 'provider' | 'model' | 'effort'>;
    /** The turn that asked, when it is still there. */
    asked: BotTurnEntity | null;
    now: Date;
  },
): BotApprovalOutcome {
  const { bot, asked, now } = context;
  const turnProps = {
    organizationId: bot.organizationId,
    botId: bot.id,
    requestedByUserId: decider.userId,
    provider: bot.provider,
    model: bot.model ?? botDefaultModel(bot.provider).id,
    effort: bot.effort,
    timeZone: asked?.timeZone ?? null,
    credentialScopes: intersectScopes(asked ? asked.credentialScopes : [], decider.scopes),
  };
  const reach = reachOf(decision);
  if (reach) {
    approval.approve(decider.userId, now, decider.scopes, reach);
    const permission = approval.standing();
    return {
      effects: {
        runCall: { by: decider.name },
        continuation: decisionTurn(turnProps, approval, decider.name, 'started'),
        ...(permission && { standing: { permission, maxGrants: BOT_TOOL_GRANTS_MAX } }),
      },
      cancelAsking: false,
    };
  }
  approval.deny(decider.userId, now, decider.note, decider.scopes);
  if (decision === 'stop') {
    return {
      effects: { line: stoppedLine(approval, decider.name) },
      cancelAsking: asked?.status === 'running',
    };
  }
  return {
    effects: { continuation: decisionTurn(turnProps, approval, decider.name) },
    cancelAsking: false,
  };
}
