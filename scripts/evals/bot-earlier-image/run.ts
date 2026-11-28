#!/usr/bin/env -S pnpm exec tsx
// A follow-up about an image sent in an earlier message is answered by
// looking at it again (`view_image`), never by asking the person to send it
// again. On 2026-11-28 a bot on GPT-6.2 Sol was asked "Whici is this
// product?" right after an image, on a turn that was not sent the image, and
// replied "send me the photo again, I can't see the earlier one".
//
// What it measures is the note an earlier image leaves in the history
// (`core/turn-images.came-with`, written by the production
// `withEarlierImages`) and `view_image`'s description (`core/tools-images`).
// Each case is the earlier messages and the person's new one; the runner
// builds the real system prompt, serves `view_image` with its production
// description as a stub that answers with a description of the picture
// (this transport carries no images), and runs one turn.
//
// A case with `mustView` is right when the turn calls `view_image` with that
// id and does not ask the person to send the image again. A case without one
// (the answer is already in the chat) is right when it does not call it.
//
//   pnpm eval:bot-earlier-image                       every case, 3 runs each
//   pnpm eval:bot-earlier-image --case which-product --runs 1
//   env: BOT_EARLIER_IMAGE_EVAL_MODEL (default claude-sonnet-5-5)
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { withEarlierImages } from '../../../apps/api/src/bots-chat/domain/bot-image.policy';
import { VIEWED_IMAGES_PER_TURN } from '../../../apps/api/src/bots-chat/domain/bot-image-view.policy';
import { composeBotSystemPrompt } from '../../../apps/api/src/bots-chat/domain/bot-prompt.policy';
import { promptText } from '../../../apps/api/src/bots-chat/domain/bot-prompt-text.policy';
import {
  composeTurnContext,
  withTurnContext,
} from '../../../apps/api/src/bots-chat/domain/bot-turn-context.policy';
import {
  arg,
  type EvalTool,
  fromApi,
  pool,
  type Transport,
  transport,
  writeReport,
} from '../bot-turn';

const HERE = dirname(fileURLToPath(import.meta.url));
const { botSoulFor } = fromApi('@oppenheimer/shared') as typeof import('@oppenheimer/shared');

interface Earlier {
  role: 'user' | 'assistant';
  content: string;
  images?: { id: string; name: string }[];
}
interface Case {
  id: string;
  earlier: Earlier[];
  message: string;
  /** What the stub answers in the image's place. */
  seen: string;
  /** The id the turn must look at, or null when it need not look. */
  mustView: string | null;
}
interface Cases {
  bot: { name: string };
  cases: Case[];
}

function viewImage(item: Case): EvalTool {
  const images = item.earlier.flatMap((message) => message.images ?? []);
  return {
    name: 'view_image',
    description: promptText('core/tools-images.view-image', {
      viewsPerTurn: String(VIEWED_IMAGES_PER_TURN),
    }),
    inputSchema: {
      type: 'object',
      additionalProperties: false,
      required: ['image_id'],
      properties: {
        image_id: { type: 'string', description: promptText('core/tools-images.view-image-id') },
      },
    },
    run: async (input) => {
      const id = String((input as { image_id?: string } | undefined)?.image_id ?? '');
      const image = images.find((candidate) => candidate.id === id);
      if (!image) {
        return { content: promptText('core/tools-images.not-found', { id }), isError: true };
      }
      return {
        content: `${promptText('core/tools-images.viewed', { name: image.name })}\n[the image: ${item.seen}]`,
      };
    },
  };
}

/** The bot's other tools, as stubs, so it answers as a bot that can do its job. */
const STUBS: EvalTool[] = [
  ['add_to_shopping_list', "Adds items to the person's shopping list."],
  ['web_search', 'Searches the web.'],
  ['check_back', 'Brings you back to this chat at a later time.'],
].map(([name, description]) => ({
  name,
  description,
  inputSchema: { type: 'object', additionalProperties: true, properties: {} },
  run: async () => ({ content: 'Done.' }),
}));

/** The earlier messages as the history reads them, each with its production image note. */
function historyText(earlier: readonly Earlier[]): string {
  return earlier
    .map((message) => {
      const read = withEarlierImages(
        {
          role: message.role,
          content: message.content,
          attachments: message.images ?? [],
        },
        true,
      );
      const who = message.role === 'user' ? 'The person' : 'You';
      return `${who}:\n<message>\n${read.content}\n</message>`;
    })
    .join('\n\n');
}

/** A reply that asks for the image again, in English or Spanish. */
const ASKS_AGAIN =
  /\b(send|share|upload|attach)\b[^.?!]*\b(again|once more)\b|\bre-?(send|upload|share)\b|reenv[ií]a|vuelve a (enviar|mandar)|can(?:'|no)t see (it|the (earlier|previous|image|photo))/i;

async function runOnce(via: Transport, data: Cases, item: Case) {
  const tools = [viewImage(item), ...STUBS];
  const system = composeBotSystemPrompt({
    name: data.bot.name,
    description: 'Keeps the household shopping on track.',
    soul: botSoulFor(data.bot.name),
    instructions: 'Keep the weekly shopping list and answer questions about what to buy.',
    facts: [],
    personFacts: [],
    engineCapabilities: [],
    tools: tools.map((tool) => ({
      name: tool.name,
      description: tool.description,
      group: tool.name === 'view_image' ? 'self' : 'web',
    })),
  });
  const context = composeTurnContext({
    now: new Date('2026-11-28T11:25:29Z'),
    timeZone: 'Europe/Madrid',
    homeHost: null,
    hosts: [],
    lastContext: null,
  });
  const message = `The conversation so far:\n\n${historyText(item.earlier)}\n\nThe person's new message:\n${item.message}`;
  const turn = await via.turn({
    system,
    message: withTurnContext(context, message),
    tools,
    maxTurns: 5,
  });
  const views = turn.calls.filter((call) => call.tool === 'view_image');
  const viewedRight = views.some(
    (call) => (call.input as { image_id?: string } | undefined)?.image_id === item.mustView,
  );
  const askedAgain = ASKS_AGAIN.test(turn.answer);
  const right = item.mustView ? viewedRight && !askedAgain : views.length === 0;
  return { right, views: views.length, askedAgain, answer: turn.answer, stopped: turn.stopped };
}

async function main(): Promise<void> {
  const data = JSON.parse(readFileSync(join(HERE, 'cases.json'), 'utf8')) as Cases;
  const only = arg('case');
  const runs = Number(arg('runs') ?? 3);
  const cases = data.cases.filter((item) => !only || item.id === only);
  if (cases.length === 0) throw new Error(`No case named ${only}`);
  // biome-ignore lint/suspicious/noUndeclaredEnvVars: a root script, not a Turborepo task — nothing caches its output.
  const via = transport(process.env.BOT_EARLIER_IMAGE_EVAL_MODEL ?? 'claude-sonnet-5-5');
  const jobs = cases.flatMap((item) => Array.from({ length: runs }, () => item));
  const results = await pool(jobs, 4, (item) =>
    runOnce(via, data, item).then((run) => ({ id: item.id, ...run })),
  );
  let failed = 0;
  for (const item of cases) {
    const mine = results.filter((run) => run.id === item.id);
    const right = mine.filter((run) => run.right).length;
    // A majority, as the other bot evals take.
    const pass = right * 2 > mine.length;
    if (!pass) failed += 1;
    console.log(`${pass ? 'pass' : 'FAIL'}  ${item.id.padEnd(20)} ${right}/${mine.length} right`);
    for (const run of mine) {
      const marks = [
        run.views ? `[view_image x${run.views}]` : '',
        run.askedAgain ? '[asks again]' : '',
      ]
        .filter(Boolean)
        .join(' ');
      console.log(`      ${marks} ${JSON.stringify(run.answer.slice(0, 240))}`);
    }
  }
  const right = results.filter((run) => run.right).length;
  console.log(
    `\n${via.model} (${via.engine}): ${right}/${results.length} runs right; ${failed} of ${cases.length} cases failed.`,
  );
  console.log(`Report: ${writeReport(HERE, { model: via.model, engine: via.engine, results })}`);
  if (failed > 0) process.exitCode = 1;
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
