#!/usr/bin/env -S pnpm exec tsx
// Does a bot in a WhatsApp group read who each line is for, answer the ones
// meant for it, and keep out of the rest?
//
// Since 2026-11-21 every line with words in an allowed group wakes its bot.
// On 2026-11-25 the owner wrote "Se lo decia a Adri haha" in a group, saying
// the line before was for Adri, and the bot cut in with "Jaja, perdona, me
// colé". A group turn is now told to read the last messages, work out who
// the new one is for, and reply only `[silent]` when it is not for the bot
// (`core/turn-context.contact-group-who`), which `contactReplyOf` sends to no
// one.
//
// Each case is a group's last messages and a new one. The runner builds the
// contact turn as production does: the bot's system prompt with no tools,
// the contact's turn context (`composeTurnContext` with `contact: 'group'`),
// the earlier lines as the Claude engine's transcript (`renderTranscript`),
// each person's line fenced as the wake fences it
// (`whatsappContactOpening`), then the new line. The run is scored on what
// production would send the group (`contactReplyOf`).
//
//   pnpm eval:bot-group-chat                                    every case, 3 runs each
//   pnpm eval:bot-group-chat --case correction-for-someone-else one case
//   pnpm eval:bot-group-chat --runs 5
//   pnpm eval:bot-group-chat --control                          without the group line
//   env: BOT_GROUP_CHAT_EVAL_MODEL (default claude-sonnet-5-5)
//        ANTHROPIC_API_KEY: with it, the Messages API; without it, the
//        machine's Claude Code login, through the Agent SDK
//
// It passes when every case is right on a majority of its runs. Each run's
// reply goes to `reports/`.
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { contactReplyOf } from '../../../apps/api/src/bots-chat/domain/bot-channel-turn.policy';
import { composeBotSystemPrompt } from '../../../apps/api/src/bots-chat/domain/bot-prompt.policy';
import { promptText } from '../../../apps/api/src/bots-chat/domain/bot-prompt-text.policy';
import {
  composeTurnContext,
  withTurnContext,
} from '../../../apps/api/src/bots-chat/domain/bot-turn-context.policy';
import { whatsappContactOpening } from '../../../apps/api/src/bots-chat/domain/bot-whatsapp-turn.policy';
import { renderTranscript } from '../../../packages/backend/agents/src/claude/claude-options';
import { arg, pool, type Turn, transport, writeReport } from '../bot-turn';

interface Person {
  name: string;
  phone: string;
}

interface Line {
  /** A key of `people`, or `bot` for what the bot said. */
  from: string;
  text: string;
}

interface Case {
  id: string;
  why: string;
  history: Line[];
  message: Line;
  /** `answer`: the line is for the bot. `silent`: it is not, and the group hears nothing. */
  expect: 'answer' | 'silent';
}

interface Score {
  right: boolean;
  /** One letter per run: A answered, S kept out, a answered when it should have kept out, s kept out when it should have answered, - failed. */
  mark: string;
  sent: string | null;
}

const HERE = dirname(fileURLToPath(import.meta.url));
const MAX_PARALLEL = 4;
const IDS = {
  conversationId: 'd0000000-0000-4000-8000-000000000001',
  accountId: 'e0000000-0000-4000-8000-000000000001',
  messageRowId: 'f0000000-0000-4000-8000-000000000001',
};

/** A person's line as the wake stores it: fenced, with who wrote it and in which group. */
function openingOf(line: Line, people: Record<string, Person>, group: string): string {
  const person = people[line.from];
  if (!person) throw new Error(`No person "${line.from}".`);
  return whatsappContactOpening({
    ...IDS,
    whatsappAccountId: IDS.accountId,
    chatKind: 'group',
    chatName: group,
    senderName: person.name,
    sender: person.phone,
    text: line.text,
  });
}

function scoreRun(turn: Turn, c: Case): Score {
  const texts = turn.blocks.map((block) => block.text);
  const sent = contactReplyOf({ status: turn.stopped ? 'failed' : 'completed' }, texts);
  if (turn.stopped) return { right: false, mark: '-', sent };
  const silent = sent === null;
  if (c.expect === 'silent') return { right: silent, mark: silent ? 'S' : 'a', sent };
  return { right: !silent, mark: silent ? 's' : 'A', sent };
}

function cut(text: string, max = 140): string {
  const flat = text.replace(/\s+/g, ' ').trim();
  return flat.length > max ? `${flat.slice(0, max)}…` : flat;
}

async function main(): Promise<void> {
  // biome-ignore lint/suspicious/noUndeclaredEnvVars: a root script, not a Turborepo task — nothing caches its output.
  const via = transport(process.env.BOT_GROUP_CHAT_EVAL_MODEL ?? 'claude-sonnet-5-5');
  const runs = Number(arg('runs') ?? 3);
  const only = arg('case');
  const control = process.argv.includes('--control');
  const file = JSON.parse(readFileSync(join(HERE, 'cases.json'), 'utf8')) as {
    now: string;
    group: string;
    bot: { name: string; description: string; instructions: string };
    people: Record<string, Person>;
    cases: Case[];
  };
  const chosen = file.cases.filter((c) => !only || c.id === only);
  if (chosen.length === 0) throw new Error(`No case "${only}".`);

  // A contact's turn: no tools, none of the owner's memory (`turnReach`).
  const system = composeBotSystemPrompt({
    name: file.bot.name,
    description: file.bot.description,
    soul: '',
    instructions: file.bot.instructions,
    facts: [],
    engineCapabilities: [],
    tools: [],
  });
  const composed = composeTurnContext({
    now: new Date(file.now),
    timeZone: 'Europe/Madrid',
    homeHost: null,
    hosts: null,
    lastContext: null,
    contact: 'group',
  });
  const whoLine = promptText('core/turn-context.contact-group-who');
  if (!composed.includes(whoLine))
    throw new Error('The group turn no longer carries its who line.');
  const context = control ? composed.replace(`${whoLine}\n`, '') : composed;

  const messageOf = (c: Case) => {
    const history = c.history.map((line) =>
      line.from === 'bot'
        ? { role: 'assistant' as const, text: line.text }
        : { role: 'user' as const, text: openingOf(line, file.people, file.group) },
    );
    const transcript = renderTranscript(history);
    const turn = withTurnContext(context, openingOf(c.message, file.people, file.group));
    return transcript ? `${transcript}\n\n${turn}` : turn;
  };

  const jobs = chosen.flatMap((c) => Array.from({ length: runs }, () => c));
  const turns = await pool(jobs, MAX_PARALLEL, (c) =>
    via.turn({ system, message: messageOf(c), tools: [], maxTurns: 2, maxTokens: 1024 }),
  );
  const results = chosen.map((c, i) => {
    const caseTurns = turns.slice(i * runs, (i + 1) * runs);
    const scores = caseTurns.map((turn) => scoreRun(turn, c));
    const right = scores.filter((score) => score.right).length;
    return { ...c, turns: caseTurns, scores, right, passed: right * 2 > runs };
  });

  const width = Math.max(...results.map((r) => r.id.length));
  for (const r of results) {
    console.log(
      `${r.passed ? 'pass' : 'FAIL'}  ${r.id.padEnd(width)}  want ${r.expect.padEnd(6)}  got ${r.scores.map((s) => s.mark).join('')}  ${r.right}/${runs}`,
    );
    r.scores.forEach((score, at) => {
      const turn = r.turns[at] as Turn;
      const said = score.sent === null ? '(nothing sent)' : cut(score.sent);
      console.log(`      run ${at + 1}: ${said}${turn.stopped ? ` [${turn.stopped}]` : ''}`);
    });
  }
  const total = results.length * runs;
  const right = results.reduce((sum, r) => sum + r.right, 0);
  const failed = results.filter((r) => !r.passed).length;
  console.log(
    `\n${via.model} (${via.engine})${control ? ', control: no group line' : ''}: ${right}/${total} runs right; ${failed} of ${results.length} cases failed.`,
  );
  console.log(
    `Report: ${writeReport(HERE, { model: via.model, engine: via.engine, control, runs, results })}`,
  );
  process.exit(failed === 0 ? 0 : 1);
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(2);
});
