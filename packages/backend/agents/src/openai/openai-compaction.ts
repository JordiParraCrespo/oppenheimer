import type { BotCompletion, BotEngineEvent } from '../bot-engine';
import { BOT_COMPACTION_KEEP_TOKENS } from '../bot-engine';

/**
 * One item of what a turn's model call is sent, as plain structure: the
 * Responses API's input items as the OpenAI Agents SDK keeps them (a
 * message, a reasoning item, a function call, its result).
 */
export type CompactableItem = { type?: string; role?: string } & Record<string, unknown>;

/**
 * An SDK's items as the plain structure compaction reads. Every Responses API
 * input item is an object with these optional fields, so this is the one
 * place a caller's item type is read as `CompactableItem`.
 */
function compactable<Item>(items: readonly Item[]): readonly CompactableItem[] {
  return items as unknown as readonly CompactableItem[];
}

/** What a model call is sent, as the SDK's `callModelInputFilter` hands it over. */
export interface ModelInput<Item> {
  instructions?: string;
  input: Item[];
}

/** Asks the turn's own model for the summary; rejects when it cannot. */
export type Summarize = (prompt: string) => Promise<BotCompletion>;

/** What an image in an item counts as, in characters: about what a model charges for one. */
const IMAGE_CHARS = 6_000;

/** The most of one item a summary reads; the rest of a long tool answer is cut. */
const ITEM_CHARS = 4_000;

/** The most of the folded items a summary reads in one call, newest kept. */
const SUMMARY_INPUT_CHARS = 240_000;

/** The longest summary kept; a longer answer is cut. */
const SUMMARY_MAX_CHARS = 16_000;

/**
 * The prompt that folds the earlier part of a turn into a summary, from
 * OpenClaw's compaction prompt (`research/lessons-from-long-running-agents.md`):
 * the same headings every time, and an update of the last summary rather
 * than a new one, so nothing it held is dropped.
 */
export const COMPACTION_PROMPT = `You are compacting the context of an agent that is in the middle of its work. The part of its work below will be removed from what it reads and replaced by your summary, so write the handoff the agent needs to carry on without it. Keep facts, ids, names, paths, numbers, decisions and what is still open; drop chatter. Quote the person's request word for word.

Write in exactly these sections:
## Goal
## Constraints and preferences
## Progress
### Done
### In progress
### Blocked
## Key decisions
## Next steps
## Critical context

When there is a previous summary, update it with what happened since: keep what still holds, move finished work to Done, and do not lose anything it held that still matters.`;

/** Roughly how many tokens `text` is: four characters to a token. */
export function estimateTokens(chars: number): number {
  return Math.ceil(chars / 4);
}

/**
 * An item's size in characters as the model would read it. Text counts in
 * full, a tool's long answer included; an image's data counts as
 * `IMAGE_CHARS`, and a reasoning item's encrypted content, which the model
 * reads back as the reasoning it stands for, as its length.
 */
function itemChars(item: unknown): number {
  let chars = 0;
  const visit = (value: unknown): void => {
    if (typeof value === 'string') {
      chars += value.startsWith('data:') ? IMAGE_CHARS : value.length;
    } else if (Array.isArray(value)) value.forEach(visit);
    else if (value && typeof value === 'object') {
      for (const [key, inner] of Object.entries(value)) {
        chars += key.length;
        visit(inner);
      }
    }
  };
  visit(item);
  return chars;
}

/** The text of an item as the summary reads it, cut to `ITEM_CHARS`. */
function itemText(item: CompactableItem): string {
  const type = item.type ?? 'message';
  let text: string;
  if (type === 'message') {
    text = `${item.role ?? 'user'}: ${partsText(item.content)}`;
  } else if (type === 'function_call') {
    text = `called ${String(item.name)} with ${String(item.arguments ?? '')}`;
  } else if (type === 'function_call_result') {
    text = `${String(item.name ?? 'tool')} answered: ${partsText(item.output)}`;
  } else {
    return '';
  }
  return text.length > ITEM_CHARS ? `${text.slice(0, ITEM_CHARS)}… [cut]` : text;
}

function partsText(content: unknown): string {
  if (typeof content === 'string') return content;
  if (Array.isArray(content)) return content.map(partsText).filter(Boolean).join('\n');
  if (content && typeof content === 'object') {
    const part = content as { type?: string; text?: unknown; refusal?: unknown };
    if (typeof part.text === 'string') return part.text;
    if (typeof part.refusal === 'string') return part.refusal;
    if (part.type === 'input_image' || part.type === 'image') return '[image]';
  }
  return '';
}

function callIdOf(item: CompactableItem | undefined): unknown {
  return item?.callId ?? item?.call_id;
}

/**
 * Whether a call can be sent `items` from `index` on: only from the start of
 * an input (a person's message) or of a model's response (the item after a
 * call's result, or after a person's message), so no item is parted from
 * the reasoning that produced it; and with every result after it following
 * its own call.
 */
function canStartAt(items: readonly CompactableItem[], index: number): boolean {
  const item = items[index];
  const previous = items[index - 1];
  const startsInput = item?.type === 'message' && item.role === 'user';
  const startsResponse =
    previous?.type === 'function_call_result' ||
    (previous?.type === 'message' && previous.role === 'user');
  if (!item || item.type === 'function_call_result' || !(startsInput || startsResponse)) {
    return false;
  }
  const calls = new Set<unknown>();
  for (const later of items.slice(index)) {
    if (later.type === 'function_call') calls.add(callIdOf(later));
    if (later.type === 'function_call_result' && !calls.has(callIdOf(later))) return false;
  }
  return true;
}

/**
 * Where the newest `keepTokens` of `items` begin, moved to a point a model
 * call can start from (`canStartAt`): never a call's result without its
 * call, nor an item without the reasoning that produced it. -1 when no such
 * point lies after `from`.
 */
export function compactionCut(
  items: readonly CompactableItem[],
  from: number,
  keepTokens: number,
): number {
  let kept = 0;
  let cut = items.length;
  while (cut > from + 1) {
    const next = estimateTokens(itemChars(items[cut - 1]));
    if (kept > 0 && kept + next > keepTokens) break;
    kept += next;
    cut -= 1;
  }
  // Back first, keeping more than asked, rather than fold a call's result away from it.
  for (let index = Math.min(cut, items.length - 1); index > from; index--) {
    if (canStartAt(items, index)) return index;
  }
  for (let index = cut + 1; index < items.length; index++) {
    if (canStartAt(items, index)) return index;
  }
  return -1;
}

/**
 * Mid-turn compaction for the engines that have none of their own (the
 * OpenAI Agents SDK's): before each model call, when what it would send
 * passes `threshold` tokens, the earlier part of the turn (its history and
 * its first calls) is folded into a summary written by the turn's own model,
 * and the call is sent the summary, the turn's message and the newest
 * `BOT_COMPACTION_KEEP_TOKENS` word for word (a quarter of the threshold,
 * when that is less). The SDK keeps every item; only
 * what each call is sent changes, so a later fold updates the summary with
 * what came after the last one. A summary that fails sends the call as it
 * was: the turn goes on, and the next call tries again.
 */
export class TurnCompactor<Item> {
  private summary: string | null = null;
  /** How many of the leading items the summary stands for. */
  private folded = 0;
  private readonly events: BotEngineEvent[] = [];

  constructor(
    private readonly threshold: number,
    /** The index of the turn's own message among the items: kept after the summary once folded. */
    private readonly messageIndex: number,
    private readonly summarize: Summarize,
  ) {}

  /** What the next call is sent: compacted when it would pass the threshold. */
  async filter(data: ModelInput<Item>): Promise<ModelInput<Item>> {
    const items = data.input;
    const sent = this.view(items);
    const before = this.tokens(sent, data.instructions);
    if (before < this.threshold) return { ...data, input: sent };
    const keep = Math.min(BOT_COMPACTION_KEEP_TOKENS, Math.floor(this.threshold / 4));
    const cut = compactionCut(compactable(items), this.folded, keep);
    if (cut < 0) return { ...data, input: sent };
    let completion: BotCompletion;
    try {
      completion = await this.summarize(this.prompt(items.slice(this.folded, cut)));
    } catch {
      return { ...data, input: sent };
    }
    const text = completion.text.trim();
    if (!text) return { ...data, input: sent };
    this.summary = text.length > SUMMARY_MAX_CHARS ? text.slice(0, SUMMARY_MAX_CHARS) : text;
    this.folded = cut;
    const after = this.view(items);
    if (completion.usage) {
      const { inputTokens, outputTokens, cacheReadTokens, cacheWriteTokens } = completion.usage;
      this.events.push({
        type: 'usage',
        inputTokens,
        outputTokens,
        cacheReadTokens,
        cacheWriteTokens,
      });
    }
    this.events.push({
      type: 'compacted',
      tokensBefore: before,
      tokensAfter: this.tokens(after, data.instructions),
    });
    return { ...data, input: after };
  }

  /** The events compaction made since the last ask, handed out once. */
  take(): BotEngineEvent[] {
    return this.events.splice(0);
  }

  /** The items as a call is sent them: the summary and the turn's message in place of what they fold. */
  private view(items: Item[]): Item[] {
    if (this.summary === null) return items;
    const opening = {
      type: 'message',
      role: 'user',
      content: `<context-summary>\nWhat you did earlier in this conversation and turn, summarized to keep your context small. Carry on from it.\n${this.summary}\n</context-summary>`,
    } as unknown as Item;
    const turnMessage = items[this.messageIndex];
    const message = this.messageIndex < this.folded && turnMessage ? [turnMessage] : [];
    return [opening, ...message, ...items.slice(this.folded)];
  }

  private tokens(items: readonly Item[], instructions: string | undefined): number {
    const chars = compactable(items).reduce(
      (sum, item) => sum + itemChars(item),
      instructions?.length ?? 0,
    );
    return estimateTokens(chars);
  }

  private prompt(items: readonly Item[]): string {
    let body = compactable(items).map(itemText).filter(Boolean).join('\n\n');
    if (body.length > SUMMARY_INPUT_CHARS)
      body = `[older part cut]\n${body.slice(-SUMMARY_INPUT_CHARS)}`;
    return [
      COMPACTION_PROMPT,
      this.summary ? `<previous-summary>\n${this.summary}\n</previous-summary>` : null,
      `<work-to-fold>\n${body}\n</work-to-fold>`,
    ]
      .filter(Boolean)
      .join('\n\n');
  }
}
