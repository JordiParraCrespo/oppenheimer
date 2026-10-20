/**
 * `BotChainPolicy` (`25-bots.md` §4.6): how far bots talking to bots may go
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
    return refuse('You cannot message yourself. Do the work in this turn instead.');
  }
  if (asker.chainDepth + 1 > limits.maxDepth) {
    return refuse(
      `This request has already passed through ${asker.chainDepth + 1} bots, the most one request of the person may reach (${limits.maxDepth} bots deep). Do what you can yourself and tell the person what is left.`,
    );
  }
  if (state.asks >= limits.turnBudget) {
    return refuse(
      `Bots have already sent each other ${state.asks} messages because of this request, the most one request of the person may cause (${limits.turnBudget}). Finish with what you have and tell the person what is left.`,
    );
  }
  if (state.bots.includes(targetBotId)) {
    return refuse(
      'That bot is already working on this request further up the chain, so messaging it would go round in a circle. Answer with what you have; if you were asked, your answer goes back on its own.',
    );
  }
  return { allowed: true };
}

function refuse(refusal: string): BotChainVerdict {
  return { allowed: false, refusal };
}
