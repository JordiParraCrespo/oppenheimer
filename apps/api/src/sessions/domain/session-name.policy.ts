import type { SessionTranscriptEntry } from '@oppenheimer/shared';
import { PROMPT_TEXT, type PromptId, type PromptSlots } from './prompts/prompts.gen';

/**
 * What a session is called once its first prompt exists: a model's title, cleaned
 * by {@link cleanModelTitle}, or {@link titleFromPrompt} when no model is configured
 * or its answer does not arrive in time. Once the conversation has gone further
 * ({@link CONVERSATION_RENAME_AFTER_PROMPTS}), a model titles it once more from
 * {@link conversationTitleRequest}.
 */

/** Six words is the brief; forty characters is what a sidebar row can show. */
export const SESSION_NAME_MAX_LENGTH = 40;
const MAX_WORDS = 6;

/**
 * The openings that say nothing about the task. Stripped from the front, in any
 * order and more than once ("ok so can you please …"), so the title starts at
 * the verb.
 */
const FILLER = [
  /^(?:hey|hi|hello|ok(?:ay)?|so|well|now|right|claude)\b[\s,!.:-]*/i,
  /^please\b[\s,]*/i,
  /^(?:can|could|would|will) you\b[\s,]*/i,
  /^i(?:'d| would) like (?:you )?to\b\s*/i,
  /^i (?:want|need) (?:you )?to\b\s*/i,
  /^(?:we|you) (?:need|have) to\b\s*/i,
  /^let(?:'|’)?s\b\s*/i,
  /^help me\b\s*/i,
];

/** What a model is asked to title: a request, in the shape every LLM client takes. */
export interface SessionTitleRequest {
  system: string;
  messages: { role: 'user'; content: string }[];
  maxTokens: number;
  temperature: number;
}

/** The prompt is capped on the wire; this is what is worth sending of it. */
const PROMPT_MAX_CHARS = 2_000;

/** What the model is told a title is, with the bounds a sidebar row sets. */
function titleInstruction(id: PromptId): string {
  const slots: PromptSlots[PromptId] = {
    maxChars: String(SESSION_NAME_MAX_LENGTH),
    maxWords: String(MAX_WORDS),
  };
  return PROMPT_TEXT[id].replace(
    /\{\{(maxChars|maxWords)\}\}/g,
    (_slot, name: keyof typeof slots) => slots[name],
  );
}

/**
 * The request that asks a model for this prompt's title. Strict, because the
 * answer goes straight into a column; a 32-token budget, because a title is a
 * handful of words; temperature 0, because the same prompt naming two sessions
 * two different things is noise.
 */
export function sessionTitleRequest(prompt: string): SessionTitleRequest {
  return {
    system: titleInstruction('system/title.first-prompt'),
    messages: [{ role: 'user', content: prompt.slice(0, PROMPT_MAX_CHARS) }],
    maxTokens: 32,
    temperature: 0,
  };
}

/**
 * How many of the person's prompts a conversation needs, each answered, before
 * its title is written again from all of them. The first prompt alone often
 * says too little ("fix the bug", "continue"); by the second answered one the
 * task has usually shown where it is going.
 */
export const CONVERSATION_RENAME_AFTER_PROMPTS = 2;

/** At most this many of the person's prompts are sent, from the first. */
const CONVERSATION_MAX_PROMPTS = 6;
/** And each is cut here: a prompt's opening carries what it is about. */
const CONVERSATION_PROMPT_MAX_CHARS = 600;

/**
 * The person's prompts in a conversation, oldest first: the text of each
 * `user` entry that is something they wrote. A tool's result reaches the
 * transcript as a `user` entry with no text part, and what Claude Code writes
 * on the person's behalf (a slash command's expansion, a caveat, a reminder)
 * opens with a tag; neither is a prompt.
 */
export function promptsOf(entries: readonly SessionTranscriptEntry[]): string[] {
  return entries.flatMap((entry) => {
    if (entry.role !== 'user') return [];
    const text = entry.parts
      .filter((part) => part.kind === 'text' && part.text)
      .map((part) => part.text ?? '')
      .join('\n')
      .trim();
    return text && !text.startsWith('<') ? [text] : [];
  });
}

/**
 * The request that asks a model for a conversation's title, from the person's
 * prompts alone: what leaves the host is still only what the person wrote,
 * never the agent's answers or the code it read. Strict and deterministic for
 * the same reasons as {@link sessionTitleRequest}.
 */
export function conversationTitleRequest(prompts: readonly string[]): SessionTitleRequest {
  const listed = prompts
    .slice(0, CONVERSATION_MAX_PROMPTS)
    .map((prompt, index) => `${index + 1}. ${prompt.slice(0, CONVERSATION_PROMPT_MAX_CHARS)}`)
    .join('\n\n');
  return {
    system: titleInstruction('system/title.conversation'),
    messages: [{ role: 'user', content: listed }],
    maxTokens: 32,
    temperature: 0,
  };
}

/**
 * A title made from the prompt's own words, or `null` when it has none worth
 * using (only a code block, only a link).
 *
 * Deterministic on purpose: it is the fallback for a model that did not answer,
 * so it must not need one, and the same prompt naming two sessions two
 * different things would be noise.
 */
export function titleFromPrompt(prompt: string): string | null {
  const firstLine = prompt
    // A pasted code block or stack trace is context, not the task.
    .replace(/```[\s\S]*?(?:```|$)/g, ' ')
    .replace(/https?:\/\/\S+/g, ' ')
    .split('\n')
    .map((line) => line.replace(/^\s*(?:#+|[-*>]|\d+[.)])\s*/, '').trim())
    .find((line) => /[\p{L}\p{N}]/u.test(line));
  if (!firstLine) return null;

  let text = firstLine.replace(/\s+/g, ' ');
  for (let changed = true; changed; ) {
    changed = false;
    for (const filler of FILLER) {
      const next = text.replace(filler, '');
      if (next !== text && /[\p{L}\p{N}]/u.test(next)) {
        text = next;
        changed = true;
      }
    }
  }

  // The first sentence is the task; what follows is usually how.
  const sentence = text.split(/(?<=[.!?])\s/)[0] ?? text;
  const title = fitWords(sentence.split(' ').slice(0, MAX_WORDS));
  return title ? capitalise(title) : null;
}

/**
 * A model's answer, as a title: the first line that is not empty, without a
 * reasoning block, quotes or a trailing period, and within the length a sidebar
 * shows. `null` when nothing is left.
 *
 * The open-weights models this is usually asked of are the ones that answer
 * with a `<think>` block first; that is removed rather than truncated into the
 * name.
 */
export function cleanModelTitle(answer: string): string | null {
  const line = answer
    .replace(/<think>[\s\S]*?(?:<\/think>|$)/gi, '')
    .split('\n')
    .map((candidate) => candidate.trim())
    .find((candidate) => candidate.length > 0);
  if (!line) return null;
  const text = line
    .replace(/^(?:title\s*:\s*)/i, '')
    // A model that answers with a quoted or bolded title is answering correctly enough.
    .replace(/^["'`*_]+|["'`*_.]+$/g, '')
    .trim();
  if (!text) return null;
  return text.length <= SESSION_NAME_MAX_LENGTH ? text : fitWords(text.split(' '));
}

/** As many whole words as fit, or the first word cut when even it does not. */
function fitWords(words: readonly string[]): string {
  let title = '';
  for (const word of words) {
    const next = title ? `${title} ${word}` : word;
    if (next.length > SESSION_NAME_MAX_LENGTH) break;
    title = next;
  }
  if (!title) title = (words[0] ?? '').slice(0, SESSION_NAME_MAX_LENGTH);
  return title.replace(/[\s,;:.!?-]+$/, '');
}

function capitalise(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
}
