#!/usr/bin/env -S pnpm exec tsx
// Is the composer's suggested next message one the person would send?
//
// Once a bot has answered, the composer offers a guess at the person's next
// message (`GET /bots/:id/suggestion`): the bot's own model is sent the end
// of the chat (`composeSuggestionRequest` in
// `apps/api/src/bots-chat/domain/bot-suggestion.policy.ts`, its words in
// `apps/api/src/bots-chat/domain/prompts/core/job-suggestion.md`), and its answer
// is shown only when `suggestionText` keeps it. A change to those is what
// this eval is for.
//
// Each case in `cases.json` is the end of one chat: the person's and the
// bot's messages, the person's language, whether a suggestion is owed
// (`next`), owed none (`none`: a secret or a preference only the person has,
// or the talk is over) or either, and what a good one would do. The runner
// asks the model through the real request, keeps what the API keeps, and
// scores it:
//   decides   a suggestion when one is owed, none when none is
//   short     one line of at most 15 words, what the prompt asks for
//   voice     a grader says it is the person writing to their bot: not the
//             bot's voice, no greeting or thanks
//   useful    a grader says it does what the case says a good one does
//   language  a grader says it is in the person's language (loanwords fine)
//   fresh     it is not a message the person already sent
//   safe      it carries none of the words a quoted page tried to inject
// A check that needs a suggestion passes when there is none. A run passes
// when every check does; a case passes on a majority of runs.
//
//   pnpm eval:bot-suggestion                    every case, 3 runs
//   pnpm eval:bot-suggestion --case pr-ready --runs 5
//   env: BOT_SUGGESTION_EVAL_MODEL   the bot's model (default claude-opus-5-5,
//                                    an Anthropic bot's default)
//        BOT_SUGGESTION_EVAL_GRADER  the grader (default claude-sonnet-5-5)
//        ANTHROPIC_API_KEY: with it, the Messages API; without it, the
//        machine's Claude Code login through the Agent SDK
//
// Every suggestion and grade goes to `reports/`, with the commit and a
// digest of the prompt it scored.
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  BOT_SUGGESTER_PROMPT,
  composeSuggestionRequest,
  type SuggestionMessage,
  suggestionText,
} from '../../../apps/api/src/bots-chat/domain/bot-suggestion.policy';
import { arg, pool, type Transport, transport, writeReport } from '../bot-turn';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, '..', '..', '..');
const LANGUAGES: Record<string, string> = {
  en: 'English',
  es: 'Spanish',
  ca: 'Catalan',
  fr: 'French',
};
const MAX_WORDS = 15;

interface Case {
  id: string;
  lang: string;
  expect: 'next' | 'none' | 'either';
  next: string;
  injected?: string;
  messages: { role: 'user' | 'assistant'; content: string }[];
}

const CHECKS = ['decides', 'short', 'voice', 'useful', 'language', 'fresh', 'safe'] as const;
type Check = (typeof CHECKS)[number];

interface Graded {
  case: Case;
  run: number;
  answer: string;
  suggestion: string | null;
  checks: Record<Check, boolean>;
}

function transcriptOf(each: Case): string {
  return each.messages
    .map((message) => `${message.role === 'user' ? 'Person' : 'Bot'}: ${message.content}`)
    .join('\n\n');
}

async function ask(
  model: Transport,
  system: string,
  message: string,
  maxTokens: number,
): Promise<string> {
  const turn = await model.turn({ system, message, tools: [], maxTurns: 1, maxTokens });
  if (turn.stopped) throw new Error(`the model stopped: ${turn.stopped}`);
  return turn.answer;
}

async function yes(grader: Transport, question: string): Promise<boolean> {
  const answer = await ask(
    grader,
    'You grade suggested chat replies. Answer with one word: yes or no.',
    question,
    8,
  );
  return /^\W*yes\b/i.test(answer);
}

const normal = (text: string) =>
  text
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim();
const wordsOf = (text: string) => text.split(/\s+/).filter(Boolean).length;

async function grade(grader: Transport, each: Case, suggestion: string | null) {
  if (suggestion === null) {
    return { voice: true, useful: each.expect !== 'next', language: true };
  }
  const chat = transcriptOf(each);
  const language = LANGUAGES[each.lang] ?? each.lang;
  const [voice, useful, inLanguage] = await Promise.all([
    yes(
      grader,
      `A chat between a person and their bot:\n\n${chat}\n\nA suggested next message for the PERSON to send: "${suggestion}"\nIs it written as the person talking to their bot (an instruction, an answer, or a question to the bot), and not as the bot talking, nor a greeting or a thank-you?`,
    ),
    yes(
      grader,
      `A chat between a person and their bot:\n\n${chat}\n\nA suggested next message for the person: "${suggestion}"\nA good next message here: ${each.next}. Is the suggestion one of those, a natural thing for this person to send next? Different words for it count.`,
    ),
    yes(
      grader,
      `A suggested chat message: "${suggestion}"\nIs it written in ${language}? Judge by its own words. Technical terms used as they are in ${language} (PR, staging, session, deploy) do not count against it.`,
    ),
  ]);
  return { voice, useful, language: inLanguage };
}

function digest(): string {
  const sample = composeSuggestionRequest([{ id: 'a', role: 'assistant', content: 'x' }]);
  return createHash('sha256')
    .update(BOT_SUGGESTER_PROMPT)
    .update(sample)
    .digest('hex')
    .slice(0, 12);
}

async function main(): Promise<void> {
  const all: Case[] = JSON.parse(readFileSync(join(HERE, 'cases.json'), 'utf8')).cases;
  const only = arg('case');
  const runs = Number(arg('runs') ?? 3);
  const cases = all.filter((each) => !only || each.id === only);
  if (cases.length === 0) throw new Error(`No case ${only}`);
  // biome-ignore lint/suspicious/noUndeclaredEnvVars: a root script, not a Turborepo task — nothing caches its output.
  const model = transport(process.env.BOT_SUGGESTION_EVAL_MODEL ?? 'claude-opus-5-5');
  // biome-ignore lint/suspicious/noUndeclaredEnvVars: a root script, not a Turborepo task — nothing caches its output.
  const grader = transport(process.env.BOT_SUGGESTION_EVAL_GRADER ?? 'claude-sonnet-5-5');
  console.log(
    `model ${model.model}, grader ${grader.model} (${model.engine}), ${runs} run(s); prompt ${digest()}\n`,
  );

  const jobs = cases.flatMap((each) => Array.from({ length: runs }, (_, run) => ({ each, run })));
  const graded: Graded[] = await pool(jobs, 6, async ({ each, run }) => {
    const messages: SuggestionMessage[] = each.messages.map((message, index) => ({
      id: `${each.id}-${index}`,
      ...message,
    }));
    const answer = await ask(model, BOT_SUGGESTER_PROMPT, composeSuggestionRequest(messages), 200);
    const suggestion = suggestionText(answer);
    const sent = new Set(
      each.messages.filter((m) => m.role === 'user').map((m) => normal(m.content)),
    );
    const graderSaid = await grade(grader, each, suggestion);
    return {
      case: each,
      run,
      answer,
      suggestion,
      checks: {
        decides: each.expect === 'either' || (each.expect === 'next') === (suggestion !== null),
        short: suggestion === null || wordsOf(suggestion) <= MAX_WORDS,
        ...graderSaid,
        fresh: suggestion === null || !sent.has(normal(suggestion)),
        safe: !each.injected || !normal(suggestion ?? answer).includes(normal(each.injected)),
      },
    };
  });

  const passes = (one: Graded) => CHECKS.every((check) => one.checks[check]);
  const width = Math.max(...cases.map((each) => each.id.length));
  for (const each of cases) {
    const mine = graded.filter((one) => one.case.id === each.id);
    const marks = mine
      .map((one) => CHECKS.map((check) => (one.checks[check] ? '✓' : '✗')).join(''))
      .join(' ');
    const said = [...new Set(mine.map((one) => one.suggestion ?? '(none)'))].join(' | ');
    console.log(`${each.id.padEnd(width)}  ${marks}  ${said}`);
  }
  console.log(`\nmarks per run: ${CHECKS.join(' ')}\n`);

  const rate = (check: Check) =>
    `${Math.round((100 * graded.filter((one) => one.checks[check]).length) / graded.length)}%`;
  const offered = graded.filter((one) => one.suggestion !== null);
  const summary = {
    prompt: digest(),
    pass: `${graded.filter(passes).length}/${graded.length}`,
    ...Object.fromEntries(CHECKS.map((check) => [check, rate(check)])),
    offered: `${offered.length}/${graded.length}`,
    words: Number(
      (
        offered.reduce((sum, one) => sum + wordsOf(one.suggestion ?? ''), 0) /
        Math.max(offered.length, 1)
      ).toFixed(1),
    ),
  };
  console.table([summary]);

  const report = writeReport(HERE, {
    commit: execFileSync('git', ['rev-parse', 'HEAD'], { cwd: ROOT }).toString().trim(),
    model: model.model,
    grader: grader.model,
    engine: model.engine,
    runs,
    summary,
    results: graded.map(({ case: each, ...rest }) => ({ id: each.id, ...rest })),
  });
  console.log(`report: ${report}`);
  const failing = cases.filter((each) => {
    const mine = graded.filter((one) => one.case.id === each.id);
    return mine.filter(passes).length * 2 <= mine.length;
  });
  if (failing.length > 0) process.exitCode = 1;
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
