import type { BotContactChat } from './bot-turn.entity';

/**
 * What a turn may reach beyond its own conversation, decided once from who it
 * answers, so the turn's context is a plain read of it. The owner's turns
 * (the console, their own chat on a channel, a routine, a wake) reach what
 * the bot can. A contact's (`BotTurnEntity.contact`) reaches nothing of the
 * owner's: no tools of the bot's or the engine's, no memory or skills, no
 * hosts, no `/command`, and only what contacts' turns said in its history,
 * even in a chat that was once the owner's.
 */
export interface TurnReach {
  /** The bot's toolbox, and the engine's own tools (web search, a todo list). */
  tools: boolean;
  /** The bot's facts and log, the general memory, what the owner wrote about themselves. */
  ownerMemory: boolean;
  /** The bot's skills, listed and run by `/<name>`. */
  skills: boolean;
  /** Whose turns the history reads: every turn's, or contacts' only. */
  history: 'all' | 'contacts';
  /**
   * Who the contact is, for the turn context, which then tells the bot only
   * that and the time (`CONTACT_LINES`): none of the owner's hosts or lines.
   */
  contact: BotContactChat | null;
}

export function turnReach(turn: { contact: BotContactChat | null }): TurnReach {
  if (turn.contact === null) {
    return {
      tools: true,
      ownerMemory: true,
      skills: true,
      history: 'all',
      contact: null,
    };
  }
  return {
    tools: false,
    ownerMemory: false,
    skills: false,
    history: 'contacts',
    contact: turn.contact,
  };
}
