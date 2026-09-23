/**
 * What a session is called once its first prompt exists.
 *
 * Two ways to get there, and both end in this file's rules. A model is asked for
 * a title first, and what it answers is cleaned by {@link cleanModelTitle}. When
 * no model is configured, or its answer does not arrive in time, the title is
 * {@link titleFromPrompt}: the prompt's own opening words, which needs no network
 * and gives the same prompt the same name every time.
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

/**
 * The request that asks a model for this prompt's title. Strict, because the
 * answer goes straight into a column; a 32-token budget, because a title is a
 * handful of words; temperature 0, because the same prompt naming two sessions
 * two different things is noise.
 */
export function sessionTitleRequest(prompt: string): SessionTitleRequest {
  return {
    system: `Write a title for a software task, from the request that follows. At most ${SESSION_NAME_MAX_LENGTH} characters and at most ${MAX_WORDS} words. Reply with the title alone: no quotes, no punctuation at the end, no explanation.`,
    messages: [{ role: 'user', content: prompt.slice(0, PROMPT_MAX_CHARS) }],
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
