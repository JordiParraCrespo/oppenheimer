import type { BotMessageRole } from '@oppenheimer/shared';

/** What a turn's system prompt is built from: the bot as it is when the turn starts. */
export interface BotPromptInput {
  name: string;
  description: string;
  soul: string;
  instructions: string;
  facts: readonly string[];
  now: Date;
}

/**
 * The bot's system prompt (`25-bots.md` §1): who it is, its job, what it
 * remembers, in that order, under headings the model can tell apart. Empty
 * documents are left out rather than shown blank.
 */
export function composeBotSystemPrompt(input: BotPromptInput): string {
  const parts = [
    `You are ${input.name}, a bot in Oppenheimer, a console where people run coding agents on their own machines. You talk with the person who owns you in a chat.`,
  ];
  if (input.description.trim()) parts.push(`Your description: ${input.description.trim()}`);
  if (input.soul.trim()) parts.push(`# SOUL.md (who you are)\n\n${input.soul.trim()}`);
  if (input.instructions.trim()) {
    parts.push(`# INSTRUCTIONS.md (your job and rules)\n\n${input.instructions.trim()}`);
  } else {
    parts.push(
      '# INSTRUCTIONS.md\n\nYou have no instructions yet. Ask what job the person wants you to do, briefly.',
    );
  }
  if (input.facts.length) {
    parts.push(`# What you remember\n\n${input.facts.map((fact) => `- ${fact}`).join('\n')}`);
  }
  parts.push(`Today is ${input.now.toISOString().slice(0, 10)}. Answer in the person's language.`);
  return parts.join('\n\n');
}

/** A message as the next turn reads it back. */
export interface HistoryMessage {
  role: BotMessageRole;
  content: string;
}

/** How many of the latest messages a turn reads back. */
export const BOT_HISTORY_MESSAGES = 40;

/**
 * The conversation a turn continues: your messages and the bot's text, oldest
 * first, the latest `BOT_HISTORY_MESSAGES` of them. Activity lines are the
 * bot's own working and are not read back.
 */
export function botHistory(
  messages: readonly HistoryMessage[],
): { role: 'user' | 'assistant'; text: string }[] {
  return messages
    .filter((message) => message.role !== 'activity' && message.content.trim())
    .slice(-BOT_HISTORY_MESSAGES)
    .map((message) => ({
      role: message.role === 'user' ? 'user' : 'assistant',
      text: message.content,
    }));
}
