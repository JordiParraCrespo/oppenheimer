import type { ChatTurn } from '@oppenheimer/frontend-consumer';
import { markdownText } from '@oppenheimer/frontend-web';

/** What the find is on: the words it looks for, and the match the chat brings into view. */
export interface ChatFindTarget {
  query: string;
  hit: ChatFindHit | null;
}

/** One place a search found: the turn it is in, and which of that turn's matches it is, from 0. */
export interface ChatFindHit {
  turnId: string;
  index: number;
}

/**
 * What a turn says in words a reader can find, as the chat draws them: the
 * person's prompt as written, the agent's replies as their markdown reads
 * (`markdownText`). Thinking, calls and their output are left out: the chat
 * folds them, and a find that opened every fold would lose the reader.
 */
function wordsOf(turn: ChatTurn): string[] {
  const words = turn.prompt?.text ? [turn.prompt.text] : [];
  for (const step of turn.steps) {
    if (step.kind === 'reply') words.push(markdownText(step.text));
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

/** The elements a run of text breaks at, as `markdownText` breaks a reply between its blocks. */
const BLOCKS = new Set([
  'P',
  'LI',
  'PRE',
  'H2',
  'H3',
  'H4',
  'H5',
  'H6',
  'TD',
  'TH',
  'BLOCKQUOTE',
  'SUMMARY',
  'DIV',
]);

/**
 * Text the chat draws around the words, not in them: a code block's band
 * (its language), a prompt's attachments and its trail (when it was sent).
 */
const CHROME =
  '[data-slot="code-block-band"], [data-slot="chat-user-message-attachments"], [data-slot="chat-user-message-trail"], button';

function blockOf(node: Node, root: Element): Element {
  for (let at = node.parentElement; at && at !== root; at = at.parentElement) {
    if (BLOCKS.has(at.tagName)) return at;
  }
  return root;
}

/**
 * `text` lowercased, and where each of its offsets falls in `text`: a
 * character can lower to more than one (`İ` to `i̇`), and a range is set on
 * the text as drawn. The offset past the end maps to the end.
 */
function folded(text: string): { lower: string; origin: number[] } {
  let lower = '';
  const origin: number[] = [];
  let at = 0;
  for (const char of text) {
    const low = char.toLocaleLowerCase();
    for (let unit = 0; unit < low.length; unit++) origin.push(at);
    lower += low;
    at += char.length;
  }
  origin.push(text.length);
  return { lower, origin };
}

/**
 * Every match of `needle` in the words of one element, as ranges: its text
 * nodes read as one string, a newline where one block ends and the next
 * begins, so a match across a bold word or a link is found and one across
 * two paragraphs is not, as `findInChat` counts them. The two read the
 * same words; `chat-find-agreement.spec.tsx` holds them to it.
 */
export function findRangesIn(element: Element, needle: string): Range[] {
  const nodes: { node: Text; start: number }[] = [];
  let text = '';
  let block: Element | null = null;
  const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT);
  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    if (node.parentElement?.closest(CHROME)) continue;
    const at = blockOf(node, element);
    if (block && at !== block) text += '\n';
    block = at;
    nodes.push({ node: node as Text, start: text.length });
    text += (node as Text).data;
  }
  // The text node an offset falls in: the last that starts at it, or before
  // it for a range's end.
  const locate = (offset: number, end: boolean) => {
    let found = nodes[0];
    for (const entry of nodes) {
      if (end ? entry.start < offset : entry.start <= offset) found = entry;
      else break;
    }
    return { node: found.node, offset: offset - found.start };
  };
  const { lower, origin } = folded(text);
  const ranges: Range[] = [];
  for (
    let from = lower.indexOf(needle);
    from >= 0;
    from = lower.indexOf(needle, from + needle.length)
  ) {
    const start = locate(origin[from], false);
    const end = locate(origin[from + needle.length], true);
    const range = document.createRange();
    range.setStart(start.node, start.offset);
    range.setEnd(end.node, end.offset);
    ranges.push(range);
  }
  return ranges;
}
