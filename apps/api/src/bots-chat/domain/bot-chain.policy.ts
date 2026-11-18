import { promptText } from './bot-prompt-text.policy';
/**
 * `BotChainPolicy`: how far bots talking to bots may go
 * because of one message of yours. A chain starts at that message; every turn
 * a bot queues on another bot because of it joins the chain one bot deeper.
 * The numbers live here and nowhere else.
 */
export const BOT_CHAIN_LIMITS = {
  /** Bots deep: you → A → B → C, and C asks nobody. */
  maxDepth: 3,
  /** Turns bots may queue on other bots in one chain; answers to asks are not counted. */
  turnBudget: 10,
} as const;

export type BotChainLimits = { readonly maxDepth: number; readonly turnBudget: number };

/** What the chain holds when another bot is about to be asked, read under the chain's lock. */
export interface BotChainState {
  /**
   * The bots already in the chain: the one your message went to, and every
   * bot a turn of the chain ran or waits on.
   */
  bots: readonly string[];
  /** The turns bots have queued on other bots so far. */
  asks: number;
}

export type BotChainVerdict = { allowed: true } | { allowed: false; refusal: string };

/**
 * Whether the asking turn may queue a turn on `targetBotId`. Refused: a bot
 * asking itself; a chain already `maxDepth` bots deep; a chain that spent its
 * `turnBudget`; and a bot already in the chain, which is a cycle (an answer to
 * an ask goes back on its own path and is never asked through here). A
 * refusal is the sentence the asking bot reads as its tool's answer: what
 * stopped it, and to report back rather than route around it.
 */
export function checkBotChain(
  asker: { botId: string; chainDepth: number },
  targetBotId: string,
  state: BotChainState,
  limits: BotChainLimits = BOT_CHAIN_LIMITS,
): BotChainVerdict {
  if (targetBotId === asker.botId) {
    return refuse(promptText('tools/peer-messages.check-bot-chain-cannot-message-yourself'));
  }
  if (asker.chainDepth + 1 > limits.maxDepth) {
    return refuse(
      promptText('tools/peer-messages.check-bot-chain-request-has-already', {
        chainDepth: String(asker.chainDepth + 1),
        maxDepth: String(limits.maxDepth),
      }),
    );
  }
  if (state.asks >= limits.turnBudget) {
    return refuse(
      promptText('tools/peer-messages.check-bot-chain-bots-have-already', {
        asks: String(state.asks),
        turnBudget: String(limits.turnBudget),
      }),
    );
  }
  if (state.bots.includes(targetBotId)) {
    return refuse(promptText('tools/peer-messages.check-bot-chain-bot-already-working'));
  }
  return { allowed: true };
}

function refuse(refusal: string): BotChainVerdict {
  return { allowed: false, refusal };
}
