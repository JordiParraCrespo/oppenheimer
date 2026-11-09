import { type StoredTexts, storedTexts } from '@oppenheimer/frontend-web';

/**
 * Long pastes in a bot's composer, the way Claude Code and Codex hold them: a
 * paste past `collapsesPaste` goes into the field as one short label
 * (`[Pasted text #1 +1000 lines]`) and its text is kept beside the draft, to
 * take the label's place when the message is sent (`expandPastes`). The
 * field stays a few lines tall and readable around what was pasted.
 *
 * A label is one piece: Backspace at its end or Delete at its start takes it
 * out whole (`deletePasteLabel`). Edited inside, it is plain text, and its
 * paste is not sent. The pastes are kept per bot beside the draft
 * (`bot-drafts`), so a reload keeps both; a send forgets them.
 */

/** Past this many characters a paste collapses: Codex's threshold. */
const PASTE_COLLAPSE_CHARS = 1000;
/** Past this many lines a paste collapses, however short its lines. */
const PASTE_COLLAPSE_LINES = 10;

/** One collapsed paste: its label in the draft and the text it stands for. */
export interface HeldPaste {
  /** Numbers the draft's pastes from 1, in the order they were pasted. */
  n: number;
  label: string;
  text: string;
}

/** How many lines `text` spans; a trailing newline does not open another. */
export function pasteLines(text: string): number {
  return text.replace(/\r?\n$/, '').split(/\r?\n/).length;
}

/** Whether a pasted text goes into the field as a label rather than as itself. */
export function collapsesPaste(text: string): boolean {
  return text.length > PASTE_COLLAPSE_CHARS || pasteLines(text) > PASTE_COLLAPSE_LINES;
}

/**
 * The draft as it is sent: each held paste's label, wherever it still is,
 * replaced by its text. A label edited away leaves its paste out.
 */
export function expandPastes(draft: string, pastes: readonly HeldPaste[]): string {
  let expanded = draft;
  for (const paste of pastes) {
    if (expanded.includes(paste.label)) expanded = expanded.split(paste.label).join(paste.text);
  }
  return expanded;
}

/** The number the next paste takes: one past the highest held. */
export function nextPasteNumber(pastes: readonly HeldPaste[]): number {
  return pastes.reduce((highest, paste) => Math.max(highest, paste.n), 0) + 1;
}

/**
 * The label Backspace (`back`) or Delete takes out whole at a collapsed
 * caret: the one ending at the caret, or starting at it. Null for any
 * other key, a selection, or no label there, so the key does what it does.
 */
export function deletePasteLabel(
  value: string,
  start: number,
  end: number,
  key: string,
  pastes: readonly HeldPaste[],
): { start: number; end: number } | null {
  if (start !== end || (key !== 'Backspace' && key !== 'Delete')) return null;
  for (const { label } of pastes) {
    if (key === 'Backspace' && start >= label.length && value.endsWith(label, start)) {
      return { start: start - label.length, end: start };
    }
    if (key === 'Delete' && value.startsWith(label, start)) {
      return { start, end: start + label.length };
    }
  }
  return null;
}

/** Each bot's held pastes, as JSON, kept on this device beside its draft. */
export const botPasteTexts: StoredTexts = storedTexts('oppenheimer.bot-pastes.');
const stored = botPasteTexts;
const parsed = new Map<string, { raw: string; pastes: HeldPaste[] }>();

function parse(raw: string): HeldPaste[] {
  if (!raw) return [];
  try {
    const value: unknown = JSON.parse(raw);
    return Array.isArray(value)
      ? value.filter(
          (paste): paste is HeldPaste =>
            typeof paste?.n === 'number' &&
            typeof paste?.label === 'string' &&
            typeof paste?.text === 'string',
        )
      : [];
  } catch {
    return [];
  }
}

/** The pastes a bot's draft holds: what was last held, or what this browser kept. */
export function botPastes(botId: string): HeldPaste[] {
  const raw = stored.read(botId);
  const cached = parsed.get(botId);
  if (cached?.raw === raw) return cached.pastes;
  const pastes = parse(raw);
  parsed.set(botId, { raw, pastes });
  return pastes;
}

/** Writes a bot's held pastes; none forgets them. */
export function setBotPastes(botId: string, pastes: readonly HeldPaste[]): void {
  stored.write(botId, pastes.length > 0 ? JSON.stringify(pastes) : '');
}
