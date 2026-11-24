#!/usr/bin/env -S pnpm exec tsx
// Does a bot on Telegram or WhatsApp answer first, work, then come back with
// the result, answering what the person writes in between?
//
// On 2026-11-20 the owner asked a bot on WhatsApp "Can you check my active
// sessions" and heard nothing for two minutes, then a summary. Since then
// the owner's own chat sends what the bot writes before a tool call as the
// call begins, a message sent meanwhile reaches the running turn with its
// next tool result, and the turn's end sends only what came after its last
// call (`product/next-steps/answering-on-telegram-and-whatsapp.md` §4).
//
// Each case is one message from the owner on a channel. The runner builds
// the bot's real system prompt and turn context (the channel's line and
// `turn/context.as-it-goes`), serves the production session and host tools
// over the in-memory workspace (`../bot-workspace.ts`), and runs one real
// turn. A case with `steer` appends the person's mid-work message to that
// tool result with production's own `steerNote`, as the engine does.
//
// The gateways are mocked: the turn's events go through the production chain
// (`TurnTranscript`, `BotChannelAsItGoesFactory`, `BotChannelReplyResolver`,
// `DeliverChannelReplyCommandHandler`) into a stand-in command bus that
// records each `ReplyOnTelegramCommand` and `ReplyOnWhatsappCommand` the way
// the person's phone would receive it, in order, against the tool calls.
//
//   pnpm eval:bot-channel-ack                          every case, 3 runs each
//   pnpm eval:bot-channel-ack --case thanks-whatsapp   one case
//   pnpm eval:bot-channel-ack --runs 5
//   pnpm eval:bot-channel-ack --control                without the as-it-goes line
//   env: BOT_CHANNEL_ACK_EVAL_MODEL (default claude-sonnet-5-5)
//        ANTHROPIC_API_KEY: with it, the Messages API; without it, the
//        machine's Claude Code login, through the Agent SDK
//
// It passes when every case is right on a majority of its runs. Each run's
// phone, calls and answer go to `reports/`.
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { CommandBus } from '@nestjs/cqrs';
import { BotChannelAsItGoesFactory } from '../../../apps/api/src/bots-chat/application/bot-channel-as-it-goes.factory';
import { BotChannelReplyResolver } from '../../../apps/api/src/bots-chat/application/bot-channel-reply.resolver';
import {
  type TranscriptWrite,
  TurnTranscript,
} from '../../../apps/api/src/bots-chat/application/turn-transcript.policy';
import { DeliverChannelReplyCommand } from '../../../apps/api/src/bots-chat/commands/deliver-channel-reply/deliver-channel-reply.command';
import { DeliverChannelReplyCommandHandler } from '../../../apps/api/src/bots-chat/commands/deliver-channel-reply/deliver-channel-reply.command-handler';
import type {
  BotChannelChat,
  BotConversationRepositoryPort,
} from '../../../apps/api/src/bots-chat/database/bot-conversation.repository.port';
import type { BotMessageRepositoryPort } from '../../../apps/api/src/bots-chat/database/bot-message.repository.port';
import type { BotTurnRepositoryPort } from '../../../apps/api/src/bots-chat/database/bot-turn.repository.port';
import {
  type ChannelTurnLine,
  sendsAsItGoes,
} from '../../../apps/api/src/bots-chat/domain/bot-channel-turn.policy';
import type { BotMessageEntity } from '../../../apps/api/src/bots-chat/domain/bot-message.entity';
import { composeBotSystemPrompt } from '../../../apps/api/src/bots-chat/domain/bot-prompt.policy';
import { telegramTurn } from '../../../apps/api/src/bots-chat/domain/bot-telegram-turn.policy';
import type { BotTurnEntity } from '../../../apps/api/src/bots-chat/domain/bot-turn.entity';
import {
  composeTurnContext,
  withTurnContext,
} from '../../../apps/api/src/bots-chat/domain/bot-turn-context.policy';
import { whatsappTurn } from '../../../apps/api/src/bots-chat/domain/bot-whatsapp-turn.policy';
import { ReplyOnTelegramCommand } from '../../../apps/api/src/telegram/commands/reply-on-telegram/reply-on-telegram.command';
import { ReplyOnWhatsappCommand } from '../../../apps/api/src/whatsapp/commands/reply-on-whatsapp/reply-on-whatsapp.command';
import type { BotEngineEvent } from '../../../packages/backend/agents/src';
import { steerNote } from '../../../packages/backend/agents/src/turn';
import { arg, type EvalTool, pool, type Turn, transport, writeReport } from '../bot-turn';
import { type HostSpec, type ProjectSpec, type SessionSpec, workspace } from '../bot-workspace';

type Channel = 'telegram' | 'whatsapp';

interface Case {
  id: string;
  channel: Channel;
  message: string;
  /** A message the person sends while the bot works: it rides the result of call `afterCall`. */
  steer?: { afterCall: number; text: string; mentions: string[] };
  /**
   * `ack`: the request takes tools; the person hears a short line before the
   * work, then the result. `single`: nothing to do; one reply, no line first.
   */
  expect: 'ack' | 'single';
  why: string;
}

/** What the person's phone shows, in order: the bot's messages, theirs, and where the work ran. */
type PhoneLine =
  | { from: 'bot'; text: string; quotes: string | null; afterCalls: number }
  | { from: 'person'; text: string; afterCalls: number };

interface Score {
  right: boolean;
  /** One letter per run: A acked then answered, S single reply, a no line before the work, s more than one reply, m mid-work question not answered, - no reply. */
  mark: string;
  note: string;
  /** For a steer: the bot answered it in a message of its own before the result. */
  answeredBeforeEnd?: boolean;
}

const HERE = dirname(fileURLToPath(import.meta.url));
const MAX_PARALLEL = 4;
const MAX_TURNS = 10;
const ACK_MAX = 280;
const FALLBACK = 'Done, with nothing to say here.';
const TOOLS = ['list_hosts', 'list_sessions', 'get_session', 'read_session', 'search_sessions'];
const IDS = {
  organizationId: 'a0000000-0000-4000-8000-000000000001',
  botId: 'b0000000-0000-4000-8000-000000000001',
  userId: 'c0000000-0000-4000-8000-000000000001',
  conversationId: 'd0000000-0000-4000-8000-000000000001',
  accountId: 'e0000000-0000-4000-8000-000000000001',
  messageRowId: 'f0000000-0000-4000-8000-000000000001',
};

/** The owner's turn on the channel, as the wake queues it. */
function ownersTurn(c: Case): BotTurnEntity {
  const props = {
    organizationId: IDS.organizationId,
    botId: IDS.botId,
    requestedByUserId: IDS.userId,
    provider: 'anthropic' as const,
    model: 'eval',
    effort: null,
  };
  return c.channel === 'telegram'
    ? telegramTurn(props, {
        conversationId: IDS.conversationId,
        telegramAccountId: IDS.accountId,
        chatId: '123456789',
        messageId: '42',
        text: c.message,
      }).turn
    : whatsappTurn(props, {
        conversationId: IDS.conversationId,
        whatsappAccountId: IDS.accountId,
        messageRowId: IDS.messageRowId,
        text: c.message,
        voiceNote: false,
      }).turn;
}

function chatOf(channel: Channel): BotChannelChat {
  const base = { organizationId: IDS.organizationId, botId: IDS.botId };
  return channel === 'telegram'
    ? { ...base, kind: 'telegram', telegramAccountId: IDS.accountId, chatId: '123456789' }
    : {
        ...base,
        kind: 'whatsapp',
        whatsappAccountId: IDS.accountId,
        chatId: '34600111222@s.whatsapp.net',
      };
}

/** The tools the turn is served, with the case's mid-work message riding the result of its call. */
function withSteer(tools: EvalTool[], c: Case): EvalTool[] {
  if (!c.steer) return tools;
  const { afterCall, text } = c.steer;
  let made = 0;
  return tools.map((tool) => ({
    ...tool,
    run: async (input) => {
      const result = await tool.run(input);
      made += 1;
      if (made !== afterCall) return result;
      return { ...result, content: `${result.content}${steerNote([{ id: 'steer-1', text }])}` };
    },
  }));
}

/**
 * The turn's events, in the order the engine emits them, from what the model
 * wrote and called: the blocks before each call, the call, and, after the
 * call a steer rode, the `steered` event production emits there.
 */
function eventsOf(turn: Turn, c: Case): BotEngineEvent[] {
  const events: BotEngineEvent[] = [];
  for (let at = 0; at <= turn.calls.length; at++) {
    for (const block of turn.blocks.filter((b) => b.after === at)) {
      events.push({ type: 'text.done', text: block.text } as BotEngineEvent);
    }
    const call = turn.calls[at];
    if (!call) continue;
    const callId = `call-${at + 1}`;
    events.push({
      type: 'tool.started',
      callId,
      name: call.tool,
      input: call.input,
    } as BotEngineEvent);
    events.push({
      type: 'tool.finished',
      callId,
      name: call.tool,
      output: call.content,
      isError: call.isError,
    } as BotEngineEvent);
    if (c.steer && at + 1 === c.steer.afterCall) {
      events.push({
        type: 'steered',
        callId,
        steers: [{ id: 'steer-1', text: c.steer.text }],
      } as BotEngineEvent);
    }
  }
  events.push({
    type: 'done',
    reason: turn.stopped ? 'failed' : 'completed',
    ...(turn.stopped ? { error: turn.stopped } : {}),
  } as BotEngineEvent);
  return events;
}

/**
 * The person's phone for one turn: the turn's events through production's
 * transcript, as-it-goes writer, reply resolver and end-of-turn delivery,
 * into a mocked gateway that records each reply command it is handed.
 */
async function phoneOf(turn: Turn, c: Case): Promise<PhoneLine[]> {
  const phone: PhoneLine[] = [];
  let callsEnded = 0;
  const gateway = {
    execute: async (command: unknown) => {
      if (command instanceof ReplyOnTelegramCommand) {
        phone.push({
          from: 'bot',
          text: command.text,
          quotes: command.replyToId,
          afterCalls: callsEnded,
        });
      } else if (command instanceof ReplyOnWhatsappCommand) {
        phone.push({
          from: 'bot',
          text: command.text,
          quotes: command.replyToRowId,
          afterCalls: callsEnded,
        });
      } else {
        throw new Error(`The mocked gateway got ${String(command)}`);
      }
      return 1;
    },
  } as unknown as CommandBus;
  const conversations = {
    findChannelChat: async () => chatOf(c.channel),
  } as unknown as BotConversationRepositoryPort;
  const channel = new BotChannelReplyResolver(conversations, gateway);

  const entity = ownersTurn(c);
  if (!sendsAsItGoes(entity)) throw new Error('The owner’s channel turn should send as it goes.');
  entity.start(new Date());
  const stored = new Map<string, BotMessageEntity>();
  const store = async (write: TranscriptWrite) => {
    if (write.kind === 'insert' || write.kind === 'steps')
      stored.set(write.message.id, write.message);
    if (write.kind === 'unsay') for (const id of write.messageIds) stored.delete(id);
  };
  const write = await new BotChannelAsItGoesFactory(channel).wrap(entity, store);
  const transcript = new TurnTranscript(entity);
  for (const event of eventsOf(turn, c)) {
    if (event.type === 'tool.finished') callsEnded += 1;
    if (event.type === 'steered' && c.steer) {
      phone.push({ from: 'person', text: c.steer.text, afterCalls: callsEnded });
    }
    for (const written of transcript.apply(event)) await write(written);
  }
  transcript.endTurn(new Date(), null);

  const lines: ChannelTurnLine[] = [...stored.values()]
    .filter((message) => message.role === 'assistant' || message.role === 'activity')
    .sort((a, b) => a.position - b.position)
    .map((message) => ({
      role: message.role as ChannelTurnLine['role'],
      content: message.content,
    }));
  const turns = {
    findForRun: async () => ({ isNone: () => false, unwrap: () => entity }),
  } as unknown as BotTurnRepositoryPort;
  const messages = { findTurnLines: async () => lines } as unknown as BotMessageRepositoryPort;
  await new DeliverChannelReplyCommandHandler(turns, messages, channel).execute(
    new DeliverChannelReplyCommand({ turnId: entity.id }),
  );
  return phone;
}

/** A run against what its case expects, from what the phone shows. */
function scoreRun(turn: Turn, phone: PhoneLine[], c: Case): Score {
  const bot = phone.filter((line) => line.from === 'bot');
  if (bot.length === 0) return { right: false, mark: '-', note: 'the phone got nothing' };
  const last = bot[bot.length - 1] as Extract<PhoneLine, { from: 'bot' }>;
  if (c.expect === 'single') {
    return bot.length === 1
      ? { right: true, mark: 'S', note: `one reply after ${turn.calls.length} calls` }
      : {
          right: false,
          mark: 's',
          note: `${bot.length} replies: ${bot.map((b) => cut(b.text)).join(' | ')}`,
        };
  }
  if (turn.calls.length === 0) return { right: false, mark: 'a', note: 'called no tool' };
  const first = bot[0] as Extract<PhoneLine, { from: 'bot' }>;
  if (first.afterCalls > 0 || bot.length < 2) {
    return {
      right: false,
      mark: 'a',
      note: `no line before the work; first after ${first.afterCalls} calls: ${cut(first.text)}`,
    };
  }
  if (first.text.length > ACK_MAX) {
    return {
      right: false,
      mark: 'a',
      note: `the first line is ${first.text.length} characters: ${cut(first.text)}`,
    };
  }
  if (last.text.startsWith(FALLBACK) || last.text === first.text) {
    return { right: false, mark: 'a', note: `no result at the end: ${cut(last.text)}` };
  }
  if (!c.steer)
    return { right: true, mark: 'A', note: `"${cut(first.text, 80)}" then ${bot.length - 1} more` };
  const at = phone.findIndex((line) => line.from === 'person');
  if (at === -1)
    return { right: false, mark: 'm', note: 'the mid-work message never reached the turn' };
  const after = phone.slice(at + 1).filter((line) => line.from === 'bot');
  const mentions = c.steer.mentions.map((m) => m.toLowerCase());
  const answering = after.find((line) => mentions.some((m) => line.text.toLowerCase().includes(m)));
  if (!answering)
    return {
      right: false,
      mark: 'm',
      note: `nothing after it mentions ${c.steer.mentions.join('/')}`,
    };
  const answeredBeforeEnd = answering !== after[after.length - 1];
  return {
    right: true,
    mark: 'A',
    note: `acked, answered the mid-work question ${answeredBeforeEnd ? 'in a line of its own' : 'in the result'}`,
    answeredBeforeEnd,
  };
}

function cut(text: string, max = 120): string {
  const flat = text.replace(/\s+/g, ' ').trim();
  return flat.length > max ? `${flat.slice(0, max)}…` : flat;
}

function show(phone: PhoneLine[]): string {
  return phone
    .map((line) =>
      line.from === 'bot'
        ? `        [bot]    ${cut(line.text, 160)}   (after ${line.afterCalls} calls)`
        : `        [person] ${line.text}   (after ${line.afterCalls} calls)`,
    )
    .join('\n');
}

async function main(): Promise<void> {
  // biome-ignore lint/suspicious/noUndeclaredEnvVars: a root script, not a Turborepo task — nothing caches its output.
  const via = transport(process.env.BOT_CHANNEL_ACK_EVAL_MODEL ?? 'claude-sonnet-5-5');
  const runs = Number(arg('runs') ?? 3);
  const only = arg('case');
  const control = process.argv.includes('--control');
  const file = JSON.parse(readFileSync(join(HERE, 'cases.json'), 'utf8')) as {
    now: string;
    bot: { name: string; description: string; instructions: string };
    hosts: HostSpec[];
    projects: ProjectSpec[];
    sessions: SessionSpec[];
    cases: Case[];
  };
  const chosen = file.cases.filter((c) => !only || c.id === only);
  if (chosen.length === 0) throw new Error(`No case "${only}".`);
  const home = file.hosts[0] as HostSpec;
  const spaceOf = () =>
    workspace({
      home: home.name,
      hosts: file.hosts,
      projects: file.projects,
      sessions: file.sessions,
    });
  const system = (() => {
    const space = spaceOf();
    const groupOf = new Map(space.definitions.map((d) => [d.definition.name, d.group]));
    return composeBotSystemPrompt({
      name: file.bot.name,
      description: file.bot.description,
      soul: '',
      instructions: file.bot.instructions,
      facts: [],
      engineCapabilities: [],
      tools: space.tools(TOOLS).map((tool) => ({
        name: tool.name,
        description: tool.description,
        group: (groupOf.get(tool.name) ?? 'sessions') as never,
      })),
    });
  })();
  const contextOf = (c: Case) =>
    composeTurnContext({
      now: new Date(file.now),
      timeZone: 'Europe/Madrid',
      homeHost: {
        name: home.name,
        online: home.online,
        runningSessions: home.runningSessions ?? 0,
      },
      hosts: file.hosts.map((h) => ({
        name: h.name,
        online: h.online,
        runningSessions: h.runningSessions ?? 0,
      })),
      lastContext: null,
      channel: c.channel,
      asItGoes: !control,
    });

  const jobs = chosen.flatMap((c) => Array.from({ length: runs }, () => c));
  const turns = await pool(jobs, MAX_PARALLEL, (c) =>
    via.turn({
      system,
      message: withTurnContext(contextOf(c), c.message),
      // A fresh workspace each run: nothing one run did is seen by another.
      tools: withSteer(spaceOf().tools(TOOLS), c),
      maxTurns: MAX_TURNS,
      maxTokens: 4096,
    }),
  );
  const phones = await Promise.all(turns.map((turn, i) => phoneOf(turn, jobs[i] as Case)));
  const results = chosen.map((c, i) => {
    const caseTurns = turns.slice(i * runs, (i + 1) * runs);
    const casePhones = phones.slice(i * runs, (i + 1) * runs);
    const scores = caseTurns.map((turn, at) => scoreRun(turn, casePhones[at] as PhoneLine[], c));
    const right = scores.filter((score) => score.right).length;
    return { ...c, turns: caseTurns, phones: casePhones, scores, right, passed: right * 2 > runs };
  });

  const width = Math.max(...results.map((r) => r.id.length));
  for (const r of results) {
    console.log(
      `${r.passed ? 'pass' : 'FAIL'}  ${r.id.padEnd(width)}  want ${r.expect.padEnd(6)}  got ${r.scores.map((s) => s.mark).join('')}  ${r.right}/${runs}`,
    );
    r.scores.forEach((score, at) => {
      const turn = r.turns[at] as Turn;
      console.log(`      run ${at + 1}: ${score.note}${turn.stopped ? ` [${turn.stopped}]` : ''}`);
      console.log(show(r.phones[at] as PhoneLine[]));
    });
  }
  const total = results.length * runs;
  const right = results.reduce((sum, r) => sum + r.right, 0);
  const steered = results.filter((r) => r.steer).flatMap((r) => r.scores.filter((s) => s.right));
  const inALine = steered.filter((s) => s.answeredBeforeEnd).length;
  const failed = results.filter((r) => !r.passed).length;
  console.log(
    `\n${via.model} (${via.engine})${control ? ', control: no as-it-goes line' : ''}: ${right}/${total} runs right; mid-work questions answered in a line of their own ${inALine}/${steered.length}; ${failed} of ${results.length} cases failed.`,
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
