import { promptText } from './bot-prompt-text.policy';
/**
 * Which sessions a bot may end for good. A bot's session (origin `bot`) is
 * one a bot started for its owner, so a bot may close it; one the person, an
 * automation or a review started is theirs, and the bot says so instead. The
 * refusal is the model's to read, said before any card is raised.
 */
export function botSessionRefusal(session: { id: string; origin: string }): string | null {
  if (session.origin === 'bot') return null;
  const article = /^[aeiou]/.test(session.origin) ? 'an' : 'a';
  return promptText('tools/sessions.session-refusal', {
    id: session.id,
    article,
    origin: session.origin,
  });
}
