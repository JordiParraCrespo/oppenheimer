import type { BotDocumentName } from '@oppenheimer/shared/schemas/bot';

/**
 * A document as the bot's folder names it. The names are files on the host,
 * not words, so they are the same in every language.
 */
export const DOCUMENT_FILE: Record<BotDocumentName, string> = {
  soul: 'SOUL.md',
  instructions: 'INSTRUCTIONS.md',
};
