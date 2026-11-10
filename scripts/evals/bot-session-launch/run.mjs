#!/usr/bin/env node
// Does a bot launch a session the way the person asked?
//
// A person tells a bot "start it on Opus 5.5 at high effort" and expects that
// session, not the host's default (`product/versions/mvp/25-bots.md`,
// `start_session`). Each case in `cases.json` is one such message. The runner
// sends it to a real bot on a running API, exactly as the console's chat
// does, and reads the Needs input card the bot's `start_session` call raises:
// the card is the server's own reading of the launch (model resolved from the
// catalog, effort, permission, base branch), so a case passes when the card
// says what the person asked for, the call carries the fields the case names
// and none it did not ask for. A case marked `refused` passes when no card
// was raised and the bot's reply names what the agent offers instead.
// Nothing is started: every card is answered `stop`.
//
//   node scripts/evals/bot-session-launch/run.mjs                 every case
//   node scripts/evals/bot-session-launch/run.mjs --case <id>     one case
//   node scripts/evals/bot-session-launch/run.mjs --repeat 3      each case three times
//   env: BOT_EVAL_API (default http://localhost:3000/api),
//        BOT_EVAL_TOKEN (an API token with bots:write; required),
//        BOT_EVAL_BOT (the bot's id; required),
//        BOT_EVAL_PROJECT (a project the bot can see, by name; required)
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
/** How long one case may take: a turn that reads projects and hosts first takes a while. */
const CASE_TIMEOUT_MS = 180_000;
const POLL_MS = 1_500;
const ENDED = new Set(['completed', 'cancelled', 'failed']);

function arg(name) {
  const at = process.argv.indexOf(`--${name}`);
  return at === -1 ? undefined : process.argv[at + 1];
}

/** A case's message with the project put in. */
export function messageOf(testCase, project) {
  return testCase.message.replaceAll('{{project}}', project);
}

/**
 * Whether what the bot did is what the case asked for, and why not.
 * `observed` is `{ card: { input, summary } | null, started: boolean, reply }`.
 */
export function grade(testCase, observed) {
  const failures = [];
  if (observed.started) {
    failures.push('the bot started a session without a card: set it to Approve for me');
  }
  if (testCase.refused) {
    if (observed.card) failures.push(`a card was raised: ${observed.card.summary}`);
    const reply = observed.reply.toLowerCase();
    if (!(testCase.mentions ?? []).some((word) => reply.includes(word.toLowerCase()))) {
      failures.push(`the reply names none of ${JSON.stringify(testCase.mentions)}`);
    }
    if (
      /can'?t|cannot|unable/.test(reply) &&
      /choose|pick|select/.test(reply) &&
      /model/.test(reply)
    ) {
      failures.push('the reply says the model cannot be chosen');
    }
    return { pass: failures.length === 0, failures };
  }
  if (!observed.card) {
    failures.push(`no start_session card; the bot said: ${clip(observed.reply)}`);
    return { pass: false, failures };
  }
  const { input, summary } = observed.card;
  for (const text of testCase.card ?? []) {
    if (!summary.includes(text)) failures.push(`the card does not say "${text}": ${summary}`);
  }
  for (const [field, value] of Object.entries(testCase.input ?? {})) {
    if (input[field] !== value) {
      failures.push(`${field} is ${JSON.stringify(input[field])}, not ${JSON.stringify(value)}`);
    }
  }
  for (const field of testCase.absent ?? []) {
    if (input[field] !== undefined) {
      failures.push(`${field} is ${JSON.stringify(input[field])}, which nobody asked for`);
    }
  }
  return { pass: failures.length === 0, failures };
}

function clip(text, max = 240) {
  const line = text.replace(/\s+/g, ' ').trim();
  return line.length > max ? `${line.slice(0, max - 1)}…` : line;
}

function client(api, token) {
  return async (method, path, body) => {
    const response = await fetch(`${api}/v1${path}`, {
      method,
      headers: {
        authorization: `Bearer ${token}`,
        ...(body ? { 'content-type': 'application/json' } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
    });
    const text = await response.text();
    if (!response.ok) throw new Error(`${method} ${path}: ${response.status} ${text}`);
    return text ? JSON.parse(text) : null;
  };
}

/** Sends the message on a clear conversation and watches its turn until a card or its end. */
async function observe(call, botId, content) {
  await call('DELETE', `/bots/${botId}/conversation`);
  const turn = await call('POST', `/bots/${botId}/messages`, { content });
  const deadline = Date.now() + CASE_TIMEOUT_MS;
  let card = null;
  let conversation = null;
  while (Date.now() < deadline) {
    const pending = await call('GET', `/bots/${botId}/approvals?status=pending`);
    card = pending.find((approval) => approval.turnId === turn.id) ?? null;
    conversation = await call('GET', `/bots/${botId}/conversation`);
    const status = conversation.turns.find((candidate) => candidate.id === turn.id)?.status;
    if (card || ENDED.has(status)) break;
    await new Promise((resolve) => setTimeout(resolve, POLL_MS));
  }
  if (card) {
    await call('POST', `/bots/${botId}/approvals/${card.id}/decision`, {
      decision: 'stop',
      note: 'An eval: nothing is started.',
    });
  } else if (Date.now() >= deadline) {
    await call('POST', `/bots/${botId}/turns/${turn.id}/cancel`).catch(() => {});
  }
  const messages = (conversation?.messages ?? []).filter((message) => message.turnId === turn.id);
  const reply = messages
    .filter((message) => message.role === 'assistant')
    .map((message) => message.content)
    .join('\n');
  // A start_session step that names a session is one the bot started without asking.
  const started = messages.some((message) =>
    (message.steps ?? []).some((step) => step.name === 'start_session' && step.sessionId),
  );
  const timedOut = !card && Date.now() >= deadline;
  return {
    card: card ? { input: card.input, summary: card.summary, tool: card.tool } : null,
    started: !card && started,
    reply: timedOut ? `${reply}\n(timed out)` : reply,
  };
}

async function main() {
  const api = process.env.BOT_EVAL_API ?? 'http://localhost:3000/api';
  const token = process.env.BOT_EVAL_TOKEN;
  const botId = process.env.BOT_EVAL_BOT;
  const project = process.env.BOT_EVAL_PROJECT;
  if (!token || !botId || !project) {
    console.error('Set BOT_EVAL_TOKEN, BOT_EVAL_BOT and BOT_EVAL_PROJECT (README.md).');
    process.exit(2);
  }
  const only = arg('case');
  const repeat = Number(arg('repeat') ?? 1);
  const { cases } = JSON.parse(readFileSync(join(HERE, 'cases.json'), 'utf8'));
  const chosen = cases.filter((testCase) => !only || testCase.id === only);
  if (chosen.length === 0) {
    console.error(`No case ${only}.`);
    process.exit(2);
  }
  const call = client(api, token);
  const results = [];
  for (const testCase of chosen) {
    for (let run = 1; run <= repeat; run++) {
      const started = Date.now();
      let observed;
      try {
        observed = await observe(call, botId, messageOf(testCase, project));
      } catch (error) {
        observed = { card: null, started: false, reply: `error: ${error.message}` };
      }
      const verdict = grade(testCase, observed);
      results.push({ id: testCase.id, run, ms: Date.now() - started, ...verdict, observed });
      const mark = verdict.pass ? 'PASS' : 'FAIL';
      console.log(`${mark}  ${testCase.id}${repeat > 1 ? ` #${run}` : ''}`);
      for (const failure of verdict.failures) console.log(`      ${failure}`);
    }
  }
  const passed = results.filter((result) => result.pass).length;
  console.log(`\n${passed}/${results.length} passed`);
  mkdirSync(join(HERE, 'reports'), { recursive: true });
  const file = join(HERE, 'reports', `${new Date().toISOString().replace(/[:.]/g, '-')}.json`);
  writeFileSync(file, `${JSON.stringify({ api, botId, project, results }, null, 2)}\n`);
  console.log(`Report: ${file}`);
  process.exit(passed === results.length ? 0 : 1);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) await main();
