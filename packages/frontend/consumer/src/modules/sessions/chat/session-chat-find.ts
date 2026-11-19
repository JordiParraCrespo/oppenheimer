import type { ChatTurn } from './session-chat';

/** One place a search found: the turn it is in, and which of that turn's matches it is, from 0. */
export interface ChatFindHit {
  turnId: string;
  index: number;
}

/**
 * A markdown link's target, which the chat draws as the link's words alone:
 * left out, so a search counts what the reader can see.
 */
const LINK_TARGET = /\]\([^)]*\)/g;

/**
 * What a turn says in words a reader can find: the person's prompt and the
 * agent's replies. Thinking, calls and their output are left out: the chat
 * folds them, and a find that opened every fold would lose the reader.
 */
function wordsOf(turn: ChatTurn): string[] {
  const words = turn.prompt?.text ? [turn.prompt.text] : [];
  for (const step of turn.steps) {
    if (step.kind === 'reply') words.push(step.text.replace(LINK_TARGET, ']'));
  }
  return words;
}

function count(text: string, needle: string): number {
  let found = 0;
  for (let at = text.indexOf(needle); at >= 0; at = text.indexOf(needle, at + needle.length)) {
    found++;
  }
  return found;
}

/**
 * Every match of `query` in the turns the chat holds, in reading order,
 * ignoring case: what the session chat's find bar steps through. A query of
 * spaces alone finds nothing.
 */
export function findInChat(turns: readonly ChatTurn[], query: string): ChatFindHit[] {
  const needle = query.trim().toLocaleLowerCase();
  if (!needle) return [];
  const hits: ChatFindHit[] = [];
  for (const turn of turns) {
    let index = 0;
    for (const words of wordsOf(turn)) {
      const found = count(words.toLocaleLowerCase(), needle);
      for (let n = 0; n < found; n++) hits.push({ turnId: turn.id, index: index++ });
    }
  }
  return hits;
}
