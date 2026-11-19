#!/usr/bin/env -S pnpm exec tsx
// Is a session's name short and easy to tell apart from its neighbours?
//
// A session is named from its first prompt (`sessionTitleRequest`) and, once
// the agent has answered the second, once more from all of them
// (`conversationTitleRequest`), both in
// `apps/api/src/sessions/domain/session-name.policy.ts` with their words in
// `apps/api/src/sessions/domain/prompts/system/title.md`. A change to those
// words is what this eval is for.
//
// Each case in `cases.json` is one session: the person's prompts, the
// language they wrote in, and what it is really about. Cases come in groups
// of four siblings from one project, the way they sit together in the
// sidebar. The runner asks the namer model for each session's final name
// through the real request (one prompt: the first-prompt request; more: the
// conversation request), cleans it as the API does (`cleanModelTitle`), and
// scores it:
//   fits      the model's own answer is at most 40 characters, the most a
//             sidebar row shows, so the API never had to cut it (words are
//             reported, not checked: Spanish and Catalan spend more of them
//             on short function words for the same width)
//   lean      no filler opening ("Help with", "Question about", "Task") and
//             not a bare generic title ("Bug fix", "Review", "Continue")
//   specific  a grader says it names the particular thing the work is about
//   language  a grader says it is in the language the person wrote in
//   tellable  a grader that sees only this session's prompts picks its name
//             out of its group's four names: what "easy to distinguish" means
// A case passes when every check does; the eval exits 1 when any case fails.
//
//   pnpm eval:session-title                 every case
//   pnpm eval:session-title --case <id>     one case (graded against its group)
//   pnpm eval:session-title --runs 3        each name asked for 3 times
//   env: SESSION_TITLE_EVAL_MODEL  the namer (default claude-haiku-5-5)
//        SESSION_TITLE_EVAL_GRADER the grader (default claude-sonnet-5-5)
//        ANTHROPIC_API_KEY: with it, the Messages API; without it, the
//        machine's Claude Code login, through the Agent SDK
//
// Every name and grade goes to `reports/`.
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  cleanModelTitle,
  conversationTitleRequest,
  SESSION_NAME_MAX_LENGTH,
  type SessionTitleRequest,
  sessionTitleRequest,
} from '../../../apps/api/src/sessions/domain/session-name.policy';
import { arg, pool, type Transport, transport, writeReport } from '../bot-turn';

const HERE = dirname(fileURLToPath(import.meta.url));
const LANGUAGES: Record<string, string> = { en: 'English', es: 'Spanish', ca: 'Catalan' };

interface Case {
  id: string;
  group: string;
  lang: string;
  prompts: string[];
  about: string;
}

interface Named {
  case: Case;
  run: number;
  answer: string;
  name: string | null;
}

/** Openings and whole titles that say nothing about which session this is. */
const FILLER_OPENING = /^(help(ing)? (with|me)|question( about)?|task|request|working on|assist)/i;
const GENERIC_TITLE =
  /^(bug ?fix|fix(ing)? (the |a )?bug|review|continue|refactor|investigation|debugging|arregla(r)? el bug|continua(r)?)$/i;

function wordsOf(text: string): number {
  return text.split(/\s+/).filter(Boolean).length;
}

/** The model's own first line, before the API cleans or cuts it. */
function firstLine(answer: string): string {
  return (
    answer
      .replace(/<think>[\s\S]*?(?:<\/think>|$)/gi, '')
      .split('\n')
      .map((line) => line.trim())
      .find(Boolean) ?? ''
  );
}

function requestFor(each: Case): SessionTitleRequest {
  const [first, ...rest] = each.prompts;
  return rest.length === 0
    ? sessionTitleRequest(first ?? '')
    : conversationTitleRequest(each.prompts);
}

async function ask(model: Transport, request: SessionTitleRequest): Promise<string> {
  const message = request.messages.map((each) => each.content).join('\n\n');
  const turn = await model.turn({
    system: request.system,
    // Claude Code runs a message that opens with `/` as one of its own
    // commands; the API sends the prompt to the model as it is, so the eval
    // keeps it from being read as one.
    message:
      model.engine === 'claude-code' && message.startsWith('/') ? `\u200b${message}` : message,
    tools: [],
    maxTurns: 1,
    maxTokens: request.maxTokens,
  });
  if (turn.stopped) throw new Error(`the model stopped: ${turn.stopped}`);
  return turn.answer;
}

async function yes(grader: Transport, question: string): Promise<boolean> {
  const answer = await ask(grader, {
    system: 'You grade titles of software work sessions. Answer with one word: yes or no.',
    messages: [{ role: 'user', content: question }],
    maxTokens: 8,
    temperature: 0,
  });
  return /^\s*yes\b/i.test(answer);
}

const conversationOf = (each: Case) =>
  each.prompts.map((prompt, index) => `${index + 1}. ${prompt}`).join('\n');

async function pick(grader: Transport, each: Case, names: string[]): Promise<number> {
  const letters = names.map((name, index) => `${String.fromCharCode(65 + index)}. ${name}`);
  const answer = await ask(grader, {
    system:
      'A person has several work sessions open, each with a short name. Given what was asked in one of them, say which name is that session. Answer with the letter alone.',
    messages: [
      {
        role: 'user',
        content: `What the person asked in the session:\n${conversationOf(each)}\n\nThe names:\n${letters.join('\n')}`,
      },
    ],
    maxTokens: 4,
    temperature: 0,
  });
  const letter = /[A-Z]/.exec(answer.trim().toUpperCase())?.[0];
  return letter ? letter.charCodeAt(0) - 65 : -1;
}

/** A fixed order for a group's names, different for each case, so position never gives the answer away. */
function shuffled<T>(items: T[], seed: string): T[] {
  let state = [...seed].reduce((hash, char) => (hash * 31 + char.charCodeAt(0)) >>> 0, 7);
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    state = (state * 1103515245 + 12345) >>> 0;
    const j = state % (i + 1);
    [out[i], out[j]] = [out[j] as T, out[i] as T];
  }
  return out;
}

async function main(): Promise<void> {
  const all: Case[] = JSON.parse(readFileSync(join(HERE, 'cases.json'), 'utf8')).cases;
  const only = arg('case');
  const runs = Number(arg('runs') ?? 1);
  const groups = new Set(all.filter((each) => !only || each.id === only).map((each) => each.group));
  if (groups.size === 0) throw new Error(`No case ${only}`);
  const cases = all.filter((each) => groups.has(each.group));
  // biome-ignore lint/suspicious/noUndeclaredEnvVars: a root script, not a Turborepo task — nothing caches its output.
  const namer = transport(process.env.SESSION_TITLE_EVAL_MODEL ?? 'claude-haiku-5-5');
  // biome-ignore lint/suspicious/noUndeclaredEnvVars: a root script, not a Turborepo task — nothing caches its output.
  const grader = transport(process.env.SESSION_TITLE_EVAL_GRADER ?? 'claude-sonnet-5-5');
  console.log(`namer ${namer.model}, grader ${grader.model} (${namer.engine}), ${runs} run(s)\n`);

  const jobs = cases.flatMap((each) => Array.from({ length: runs }, (_, run) => ({ each, run })));
  const named: Named[] = await pool(jobs, 6, async ({ each, run }) => {
    const answer = await ask(namer, requestFor(each));
    return { case: each, run, answer, name: cleanModelTitle(answer) };
  });

  const graded = await pool(named, 6, async (one) => {
    const raw = firstLine(one.answer);
    const name = one.name ?? '';
    const siblings = named.filter(
      (other) => other.case.group === one.case.group && other.run === one.run,
    );
    const order = shuffled(siblings, `${one.case.id}:${one.run}`);
    const [specific, language, chosen] = await Promise.all([
      yes(
        grader,
        `The session is about: ${one.case.about}.\nIts name: "${name}"\nDoes the name say which particular thing the work is about (the component, screen, feature or bug), rather than only a generic action like "fix bug" or "help with code"?`,
      ),
      yes(
        grader,
        `The person wrote in ${LANGUAGES[one.case.lang] ?? one.case.lang}. The session's name: "${name}"\nIs the name written in ${LANGUAGES[one.case.lang] ?? one.case.lang}? Code identifiers and product names in any language are fine.`,
      ),
      pick(
        grader,
        one.case,
        order.map((other) => other.name ?? ''),
      ),
    ]);
    const checks = {
      fits:
        Boolean(one.name) &&
        raw.replace(/^["'`*_]+|["'`*_.]+$/g, '').length <= SESSION_NAME_MAX_LENGTH,
      lean: !FILLER_OPENING.test(name) && !GENERIC_TITLE.test(name.trim()),
      specific,
      language,
      tellable: order[chosen] === one,
    };
    return { ...one, raw, words: wordsOf(name), chars: name.length, checks };
  });

  const shown = graded.filter((one) => !only || one.case.id === only);
  const keys = ['fits', 'lean', 'specific', 'language', 'tellable'] as const;
  const width = Math.max(...shown.map((one) => one.case.id.length));
  for (const one of shown) {
    const marks = keys.map((key) => (one.checks[key] ? '✓' : '✗')).join(' ');
    console.log(`${one.case.id.padEnd(width)}  ${marks}  ${one.name ?? '(none)'}`);
  }
  const share = (key: (typeof keys)[number]) =>
    `${Math.round((100 * shown.filter((one) => one.checks[key]).length) / shown.length)}%`;
  const mean = (values: number[]) =>
    (values.reduce((sum, value) => sum + value, 0) / values.length).toFixed(1);
  const passed = shown.filter((one) => keys.every((key) => one.checks[key]));
  console.log(`\n${' '.repeat(width)}  ${keys.join(' ')}`);
  console.log(keys.map((key) => `${key} ${share(key)}`).join(', '));
  console.log(
    `words ${mean(shown.map((one) => one.words))}, characters ${mean(shown.map((one) => one.chars))}`,
  );
  console.log(`${passed.length}/${shown.length} pass`);
  const report = writeReport(HERE, {
    namer: namer.model,
    grader: grader.model,
    engine: namer.engine,
    runs,
    results: shown.map(({ case: each, ...rest }) => ({ id: each.id, group: each.group, ...rest })),
  });
  console.log(`report: ${report}`);
  if (passed.length < shown.length) process.exitCode = 1;
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
