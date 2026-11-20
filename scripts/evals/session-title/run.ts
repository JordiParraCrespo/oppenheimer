#!/usr/bin/env -S pnpm exec tsx
// Is a session's name short, and does it tell the session apart from the
// ones beside it on the same part of the product?
//
// A session is named from its first prompt (`sessionTitleRequest`) and, once
// the agent has answered the second, once more from all of them
// (`conversationTitleRequest`), both in
// `apps/api/src/sessions/domain/session-name.policy.ts` with their words in
// `apps/api/src/sessions/domain/prompts/system/title.md`. A change to those,
// or to `cleanModelTitle`, is what this eval is for.
//
// Each case in `cases.json` is one session: the person's prompts, the
// language they wrote in, what it is about, and the one detail that sets it
// apart from its siblings. A group is four sessions on the same component
// that differ only in that detail, the way they sit together in the sidebar.
// The runner asks the namer for each session's final name through the real
// request, cleans it as the API does, and scores it:
//   fits      the answer, without the prefixes the API strips, is at most 40
//             characters: the row's hard cut was not needed
//   short     at most 5 words and 32 characters, what the prompt asks for
//   lean      no filler word anywhere (fix, add, review, investigate, ... in
//             each language) and no pull request or ticket number
//   detail    a grader says the name carries what sets the case apart from
//             its siblings (`detail`: the least that does, not all it is about)
//   language  a grader says the name is in the person's language, judged by
//             its own words, with technical loanwords (login, token, 2FA) fine
//   tellable  a grader that reads only what the session is about (not the
//             person's words, so it cannot match them) picks its name out of
//             its group's four
// A name passes when every check does; a case passes on a majority of runs.
//
//   pnpm eval:session-title                       every case, 3 runs
//   pnpm eval:session-title --against <git ref>   also the prompt at that ref,
//                                                 on the same jobs, compared
//                                                 case by case
//   pnpm eval:session-title --case <id> --runs 5
//   env: SESSION_TITLE_EVAL_MODEL  the namer (default claude-haiku-5-5)
//        SESSION_TITLE_EVAL_GRADER the grader (default claude-sonnet-5-5)
//        ANTHROPIC_API_KEY: with it, the Messages API at the production
//        temperature (0); without it, the machine's Claude Code login through
//        the Agent SDK, which samples at its default, so compare over runs
//
// Every name and grade goes to `reports/`, with the commit and a digest of
// each prompt it scored.
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import * as current from '../../../apps/api/src/sessions/domain/session-name.policy';
import { arg, pool, type Transport, transport, writeReport } from '../bot-turn';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, '..', '..', '..');
const POLICY = 'apps/api/src/sessions/domain/session-name.policy.ts';
const PROMPTS = 'apps/api/src/sessions/domain/prompts/prompts.gen.ts';
const PROMPT_TEXT = 'apps/api/src/sessions/domain/session-prompt-text.policy.ts';
const LANGUAGES: Record<string, string> = {
  en: 'English',
  es: 'Spanish',
  ca: 'Catalan',
  fr: 'French',
};
const HARD_CHARS = 40;
const SHORT_WORDS = 5;
const SHORT_CHARS = 32;

interface Case {
  id: string;
  group: string;
  lang: string;
  prompts: string[];
  about: string;
  detail: string;
}

type Request = ReturnType<typeof current.sessionTitleRequest>;

interface Policy {
  label: string;
  sessionTitleRequest(prompt: string): Request;
  conversationTitleRequest(prompts: readonly string[]): Request;
  cleanModelTitle(answer: string): string | null;
}

const CHECKS = ['fits', 'short', 'lean', 'detail', 'language', 'tellable'] as const;
type Check = (typeof CHECKS)[number];

interface Graded {
  variant: string;
  case: Case;
  run: number;
  answer: string;
  name: string;
  words: number;
  chars: number;
  checks: Record<Check, boolean>;
}

/** Words that never tell two sessions apart, in the eval's languages. */
const FILLER =
  /\b(fix(es|ing)?|add(s|ing)?|help|review(ing)?|investigat\w*|issue|task|bug ?fix|arregl\w*|corregi\w*|revis\w*|investig\w*|afegi\w*|ajout\w*|corrig\w*|revue)\b/iu;
const TICKET = /\b(?:PR|MR)\s*#?\d+|#\d+/i;

/** The policy as it is at a git ref, loaded from that commit's two files. */
async function policyAt(ref: string): Promise<Policy> {
  const sha = execFileSync('git', ['rev-parse', '--short', ref], { cwd: ROOT }).toString().trim();
  const dir = join(HERE, '.against', sha);
  mkdirSync(join(dir, 'prompts'), { recursive: true });
  for (const [path, to] of [
    [POLICY, 'session-name.policy.ts'],
    [PROMPTS, 'prompts/prompts.gen.ts'],
    [PROMPT_TEXT, 'session-prompt-text.policy.ts'],
  ] as const) {
    try {
      writeFileSync(
        join(dir, to),
        execFileSync('git', ['show', `${sha}:${path}`], { cwd: ROOT, stdio: 'pipe' }),
      );
    } catch (error) {
      // The prompt reader came later than the policy; a ref before it has none.
      if (path !== PROMPT_TEXT) throw error;
    }
  }
  const loaded = (await import(join(dir, 'session-name.policy.ts'))) as Omit<Policy, 'label'>;
  if (typeof loaded.conversationTitleRequest !== 'function') {
    throw new Error(`${ref} has no conversation rename to compare against`);
  }
  return { label: sha, ...loaded };
}

function requestFor(policy: Policy, each: Case): Request {
  const [first, ...rest] = each.prompts;
  return rest.length === 0
    ? policy.sessionTitleRequest(first ?? '')
    : policy.conversationTitleRequest(each.prompts);
}

async function ask(model: Transport, request: Request): Promise<string> {
  const message = request.messages.map((each) => each.content).join('\n\n');
  const turn = await model.turn({
    system: request.system,
    // Claude Code runs a message that opens with `/` as one of its own
    // commands; the API sends it to the model as it is.
    message: model.engine === 'claude-code' && message.startsWith('/') ? `​${message}` : message,
    tools: [],
    maxTurns: 1,
    maxTokens: request.maxTokens,
    temperature: request.temperature,
  });
  if (turn.stopped) throw new Error(`the model stopped: ${turn.stopped}`);
  return turn.answer;
}

async function yes(grader: Transport, question: string): Promise<boolean> {
  const answer = await ask(grader, {
    system: 'You grade the names of software work sessions. Answer with one word: yes or no.',
    messages: [{ role: 'user', content: question }],
    maxTokens: 8,
    temperature: 0,
  });
  return /^\W*yes\b/i.test(answer);
}

async function pick(grader: Transport, about: string, names: string[]): Promise<number> {
  const listed = names.map((name, index) => `${String.fromCharCode(65 + index)}. ${name}`);
  const answer = await ask(grader, {
    system:
      'A person has several work sessions on the same part of a product, each with a short name. Given what one session is about, say which name is that session. Answer with the letter alone.',
    messages: [
      {
        role: 'user',
        content: `The session is about: ${about}\n\nThe names:\n${listed.join('\n')}`,
      },
    ],
    maxTokens: 4,
    temperature: 0,
  });
  const letter = /^\W*([A-Z])\b/.exec(answer.trim().toUpperCase())?.[1];
  return letter ? letter.charCodeAt(0) - 65 : -1;
}

/** A fixed order per case and run, from a hash of each name's id, so position never gives it away. */
function shuffled<T extends { case: Case }>(items: T[], seed: string): T[] {
  const key = (item: T) =>
    createHash('sha256').update(`${seed}:${item.case.id}`).digest().readUInt32BE(0);
  return [...items].sort((a, b) => key(a) - key(b));
}

/** The answer's first line without what `cleanModelTitle` strips, before any cut. */
function uncut(answer: string): string {
  const line =
    answer
      .replace(/<think>[\s\S]*?(?:<\/think>|$)/gi, '')
      .split('\n')
      .map((each) => each.trim())
      .find(Boolean) ?? '';
  return line
    .replace(/^(?:title|name)\s*:\s*/i, '')
    .replace(/^(?:\d+[.)]|[-*•])\s+/, '')
    .replace(/^["'`*_]+|["'`*_.]+$/g, '')
    .trim();
}

const wordsOf = (text: string) => text.split(/\s+/).filter(Boolean).length;

function digest(policy: Policy): string {
  const sample = policy.conversationTitleRequest(['a', 'b']).system;
  const first = policy.sessionTitleRequest('a').system;
  return createHash('sha256').update(first).update(sample).digest('hex').slice(0, 12);
}

/** Two-sided sign test: how likely a split at least this uneven is by chance. */
function signTest(wins: number, losses: number): number {
  const n = wins + losses;
  if (n === 0) return 1;
  const k = Math.min(wins, losses);
  let tail = 0;
  for (let i = 0; i <= k; i++) {
    let choose = 1;
    for (let j = 0; j < i; j++) choose = (choose * (n - j)) / (j + 1);
    tail += choose / 2 ** n;
  }
  return Math.min(1, 2 * tail);
}

async function main(): Promise<void> {
  const all: Case[] = JSON.parse(readFileSync(join(HERE, 'cases.json'), 'utf8')).cases;
  const only = arg('case');
  const runs = Number(arg('runs') ?? 3);
  const against = arg('against');
  const groups = new Set(all.filter((each) => !only || each.id === only).map((each) => each.group));
  if (groups.size === 0) throw new Error(`No case ${only}`);
  const cases = all.filter((each) => groups.has(each.group));
  const policies: Policy[] = [{ label: 'current', ...current }];
  if (against) policies.push(await policyAt(against));
  // biome-ignore lint/suspicious/noUndeclaredEnvVars: a root script, not a Turborepo task — nothing caches its output.
  const namer = transport(process.env.SESSION_TITLE_EVAL_MODEL ?? 'claude-haiku-5-5');
  // biome-ignore lint/suspicious/noUndeclaredEnvVars: a root script, not a Turborepo task — nothing caches its output.
  const grader = transport(process.env.SESSION_TITLE_EVAL_GRADER ?? 'claude-sonnet-5-5');
  console.log(
    `namer ${namer.model}, grader ${grader.model} (${namer.engine}), ${runs} run(s); prompts ${policies.map((policy) => `${policy.label} ${digest(policy)}`).join(', ')}\n`,
  );

  const jobs = policies.flatMap((policy) =>
    cases.flatMap((each) => Array.from({ length: runs }, (_, run) => ({ policy, each, run }))),
  );
  const named = await pool(jobs, 6, async ({ policy, each, run }) => {
    const answer = await ask(namer, requestFor(policy, each));
    return {
      variant: policy.label,
      case: each,
      run,
      answer,
      name: policy.cleanModelTitle(answer) ?? '',
    };
  });

  const graded: Graded[] = await pool(named, 6, async (one) => {
    const siblings = named.filter(
      (other) =>
        other.variant === one.variant &&
        other.case.group === one.case.group &&
        other.run === one.run,
    );
    const order = shuffled(siblings, `${one.variant}:${one.case.id}:${one.run}`);
    const language = LANGUAGES[one.case.lang] ?? one.case.lang;
    const [detail, inLanguage, chosen] = await Promise.all([
      yes(
        grader,
        `A session's name: "${one.name}"\nIt sits beside other sessions on the same part of the product. What sets this one apart from them is: ${one.case.detail}. Does the name carry that? Other words or another language for it count; naming only the shared part of the product does not.`,
      ),
      yes(
        grader,
        `A session's name: "${one.name}"\nIs it written in ${language}? Judge by its own words (articles, prepositions, verbs, nouns). Technical terms used as they are in ${language} (login, token, cookie, 2FA, PR, upload) do not count against it. A name wholly in another language is a no.`,
      ),
      pick(
        grader,
        one.case.about,
        order.map((other) => other.name),
      ),
    ]);
    const words = wordsOf(one.name);
    return {
      ...one,
      words,
      chars: one.name.length,
      checks: {
        fits: Boolean(one.name) && uncut(one.answer).length <= HARD_CHARS,
        short: words <= SHORT_WORDS && one.name.length <= SHORT_CHARS,
        lean: !FILLER.test(one.name) && !TICKET.test(one.name),
        detail,
        language: inLanguage,
        tellable: order[chosen] === one,
      },
    };
  });

  const passes = (one: Graded) => CHECKS.every((check) => one.checks[check]);
  const shown = (variant: string) =>
    graded.filter((one) => one.variant === variant && (!only || one.case.id === only));

  // One line per case: the current prompt's names, then each run's marks.
  const width = Math.max(...cases.map((each) => each.id.length));
  for (const each of cases.filter((one) => !only || one.id === only)) {
    for (const policy of policies) {
      const mine = graded.filter((one) => one.variant === policy.label && one.case.id === each.id);
      const marks = mine
        .map((one) => CHECKS.map((check) => (one.checks[check] ? '✓' : '✗')).join(''))
        .join(' ');
      const names = [...new Set(mine.map((one) => one.name || '(none)'))].join(' | ');
      const tag = policies.length > 1 ? `${policy.label.padEnd(8)} ` : '';
      console.log(`${each.id.padEnd(width)}  ${tag}${marks}  ${names}`);
    }
  }
  console.log(`\nmarks per run: ${CHECKS.join(' ')}\n`);

  const summary = policies.map((policy) => {
    const mine = shown(policy.label);
    const rate = (check: Check) =>
      Math.round((100 * mine.filter((one) => one.checks[check]).length) / mine.length);
    const perRun = Array.from(
      { length: runs },
      (_, run) => mine.filter((one) => one.run === run && passes(one)).length,
    );
    const mean = (values: number[]) =>
      Number((values.reduce((sum, value) => sum + value, 0) / values.length).toFixed(1));
    return {
      prompt: policy.label,
      digest: digest(policy),
      pass: `${mine.filter(passes).length}/${mine.length}`,
      perRun,
      ...Object.fromEntries(CHECKS.map((check) => [check, `${rate(check)}%`])),
      words: mean(mine.map((one) => one.words)),
      chars: mean(mine.map((one) => one.chars)),
    };
  });
  console.table(summary);

  let comparison: { wins: number; losses: number; ties: number; p: number } | undefined;
  if (policies.length > 1) {
    const [mine, theirs] = policies.map((policy) => policy.label) as [string, string];
    const share = (variant: string, id: string) => {
      const runsOf = graded.filter((one) => one.variant === variant && one.case.id === id);
      return runsOf.filter(passes).length / runsOf.length;
    };
    let wins = 0;
    let losses = 0;
    let ties = 0;
    for (const each of cases.filter((one) => !only || one.id === only)) {
      const delta = share(mine, each.id) - share(theirs, each.id);
      if (delta > 0) wins++;
      else if (delta < 0) losses++;
      else ties++;
    }
    comparison = { wins, losses, ties, p: Number(signTest(wins, losses).toPrecision(2)) };
    console.log(
      `current against ${theirs}, case by case: ${wins} better, ${losses} worse, ${ties} the same (sign test p = ${comparison.p})`,
    );
  }

  const report = writeReport(HERE, {
    commit: execFileSync('git', ['rev-parse', 'HEAD'], { cwd: ROOT }).toString().trim(),
    namer: namer.model,
    grader: grader.model,
    engine: namer.engine,
    runs,
    summary,
    comparison,
    results: graded.map(({ case: each, ...rest }) => ({ id: each.id, group: each.group, ...rest })),
  });
  console.log(`report: ${report}`);
  const failing = cases.filter((each) => {
    const mine = graded.filter((one) => one.variant === 'current' && one.case.id === each.id);
    return mine.filter(passes).length * 2 <= mine.length;
  });
  if (failing.length > 0) process.exitCode = 1;
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
