/**
 * When a bot may delete another (`delete_bot`, `25-bots.md` §4.6): the rules
 * that keep a slip from costing the person a bot. Checked when the card is
 * raised, so the person is never asked to approve what would be refused, and
 * again when the approved call runs, against the bots as they are then.
 */
export interface BotDeletionFacts {
  /** The bot whose turn asks: the one the person is talking to. */
  selfId: string;
  /** The bot named by id, as the owner sees it; null when there is none. */
  target: { id: string; name: string } | null;
  /** The target has a turn queued or running. */
  busy: boolean;
  /** The owner holds `delete Bot` on the target. */
  ownerMayDelete: boolean;
}

/** Why this deletion is refused, in words the bot can act on; null when it may go ahead. */
export function botDeletionRefusal(
  asked: { bot_id: string; name: string },
  facts: BotDeletionFacts,
): string | null {
  if (asked.bot_id === facts.selfId) {
    return 'Not done: you cannot delete yourself, the bot the person is talking to. If they want you gone, they can delete you from your settings.';
  }
  const { target } = facts;
  if (!target) {
    return `Not done: the workspace has no bot ${asked.bot_id}. Use list_bots to find the one the person means.`;
  }
  if (target.name !== asked.name) {
    return `Not done: bot ${target.id} is named "${target.name}", not "${asked.name}". Check list_bots and ask the person which bot they mean before trying again.`;
  }
  if (!facts.ownerMayDelete) {
    return 'Not done: the person may not delete bots in this workspace.';
  }
  if (facts.busy) {
    return `Not done: "${target.name}" is answering right now (a turn is queued or running), and deleting it would cut that off. Ask the person to stop it or wait until it is done.`;
  }
  return null;
}
