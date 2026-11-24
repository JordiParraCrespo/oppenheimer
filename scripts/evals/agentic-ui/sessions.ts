#!/usr/bin/env -S pnpm exec tsx
// Does a coding agent in a session show the person a visual when one reads
// faster than words, and only then?
//
// A session's agent shows a visual with `runner sessions show` or the
// `show_visual` tool of the runner's `oppenheimer` MCP server. Each case in
// `sessions.json` is a task and the files of a checkout; Claude Code runs it
// in a scratch folder the way a session launches it: its own system prompt,
// the runner's MCP server (its instructions and the descriptions of
// `show_visual`, `send_file` and `notify`, read off `apps/runner/internal/cli/mcp.go`
// so they cannot drift), and a `runner` on its PATH that answers `--skill`
// with the real manual (`skill.md`) and checks `sessions show` against the
// shared schema, as the console will. Both ways in are scored alike.
//
//   pnpm eval:agentic-ui:sessions                         every case, 3 runs each
//   pnpm eval:agentic-ui:sessions --case bundle-compare   one case
//   pnpm eval:agentic-ui:sessions --runs 5
//   env: AGENTIC_UI_SESSION_MODEL (default claude-sonnet-5-5), on the
//        machine's Claude Code login
//
// It passes when every case is right on a majority of its runs. Every run's
// calls and answer go to `reports/`.
import { chmodSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseVisual } from '../../../packages/shared/src/schemas/visual.schema';
import { arg, pool, writeReport } from '../bot-turn';
import { echoedNumbers } from './score';

type Expect = 'visual' | 'no_visual';

interface Case {
  id: string;
  task: string;
  files: Record<string, string>;
  expect: Expect;
  why: string;
}

/** One visual the agent sent, by either way in. */
interface Shown {
  via: 'mcp' | 'cli';
  ok: boolean;
  spec: unknown;
  errors?: string[];
}

interface Run {
  shown: Shown[];
  /** Every runner command and MCP tool the agent called, in order. */
  used: string[];
  /** Whether it read the manual (`runner --skill`). */
  readSkill: boolean;
  answer: string;
  stopped?: string;
}

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, '../../..');
const MAX_PARALLEL = 4;
const MAX_TURNS = 30;
const MCP_SOURCE = join(ROOT, 'apps/runner/internal/cli/mcp.go');
const SKILL = join(ROOT, 'apps/runner/internal/cli/skill.md');
const SHARED = join(ROOT, 'packages/shared/dist/schemas/visual.schema.js');
// The repository root depends on neither SDK: take them from the package that runs Claude for bots.
const fromAgents = createRequire(join(ROOT, 'packages/backend/agents/package.json'));

/** A Go string expression's value: its literals, joined. Enough for the plain concatenations mcp.go writes. */
function goStrings(source: string): string {
  return [...source.matchAll(/"((?:[^"\\]|\\.)*)"/g)]
    .map((match) => JSON.parse(`"${match[1]}"`) as string)
    .join('');
}

/** What the runner's MCP server says of itself and of the tools the eval serves. */
function runnerMcp(): { instructions: string; describe: (name: string) => string } {
  const source = readFileSync(MCP_SOURCE, 'utf8');
  const instructions = /const mcpInstructions = ([\s\S]*?)\n\n/.exec(source)?.[1];
  if (!instructions) throw new Error('No mcpInstructions in mcp.go.');
  return {
    instructions: goStrings(instructions),
    describe: (name) => {
      const at = source.indexOf(`"${name}",`);
      const span = /description:\s*([\s\S]*?),\n\s*(?:properties|required):/.exec(source.slice(at));
      if (at === -1 || !span?.[1]) throw new Error(`No ${name} in mcp.go.`);
      return goStrings(span[1]);
    },
  };
}

/**
 * The `runner` the agent finds on its PATH: the manual, and `sessions show`
 * checked against the shared schema with the runner's own answers. Every
 * call lands in the run's log.
 */
function runnerShim(bin: string, log: string): void {
  mkdirSync(bin, { recursive: true });
  const path = join(bin, 'runner');
  writeFileSync(
    path,
    `#!/usr/bin/env node
const fs = require('node:fs');
const { parseVisual } = require(${JSON.stringify(SHARED)});
const args = process.argv.slice(2);
const note = (entry) => fs.appendFileSync(${JSON.stringify(log)}, JSON.stringify(entry) + '\\n');
if (args[0] === '--skill') {
  note({ kind: 'skill' });
  process.stdout.write(fs.readFileSync(${JSON.stringify(SKILL)}, 'utf8'));
  process.exit(0);
}
if (args[0] === 'sessions' && args[1] === 'show') {
  const from = args[2];
  if (!from) { console.error('usage: runner sessions show <spec.json | ->'); process.exit(2); }
  let spec;
  try { spec = JSON.parse(fs.readFileSync(from === '-' ? 0 : from, 'utf8')); }
  catch (error) { note({ kind: 'show', ok: false, errors: [String(error)] }); console.error('SESS_023 The visual cannot be shown: ' + error); process.exit(1); }
  const parsed = parseVisual(spec);
  note({ kind: 'show', ok: parsed.ok, spec, errors: parsed.ok ? undefined : parsed.errors });
  if (!parsed.ok) { console.error('SESS_023 The visual cannot be shown: ' + parsed.errors.join('; ')); process.exit(1); }
  console.log('shown in the chat: ' + JSON.stringify(parsed.visual.title) + ', ' + parsed.visual.blocks.length + ' blocks; do not repeat its numbers, say what they mean');
  process.exit(0);
}
note({ kind: 'command', args });
console.log('done');
`,
  );
  chmodSync(path, 0o755);
}

async function runCase(c: Case, model: string): Promise<Run> {
  const { query } = fromAgents(
    '@anthropic-ai/claude-agent-sdk',
  ) as typeof import('@anthropic-ai/claude-agent-sdk');
  const { McpServer } = fromAgents(
    '@modelcontextprotocol/sdk/server/mcp.js',
  ) as typeof import('@modelcontextprotocol/sdk/server/mcp.js');
  const { CallToolRequestSchema, ListToolsRequestSchema } = fromAgents(
    '@modelcontextprotocol/sdk/types.js',
  ) as typeof import('@modelcontextprotocol/sdk/types.js');

  const root = mkdtempSync(join(tmpdir(), 'agentic-ui-session-'));
  const cwd = join(root, 'checkout');
  const log = join(root, 'runner.log');
  for (const [file, content] of Object.entries(c.files)) {
    mkdirSync(dirname(join(cwd, file)), { recursive: true });
    writeFileSync(join(cwd, file), content);
  }
  writeFileSync(log, '');
  runnerShim(join(root, 'bin'), log);

  const shown: Shown[] = [];
  const used: string[] = [];
  const runner = runnerMcp();
  const string = (description: string) => ({ type: 'string', description });
  const tools = [
    {
      name: 'show_visual',
      description: runner.describe('show_visual'),
      inputSchema: {
        type: 'object' as const,
        properties: {
          title: string('What it shows, in a few words.'),
          subtitle: string('The period, the source or the scope.'),
          blocks: {
            type: 'array',
            description: 'The blocks, in order.',
            items: { type: 'object' },
          },
        },
        required: ['title', 'blocks'],
      },
    },
    {
      name: 'send_file',
      description: runner.describe('send_file'),
      inputSchema: {
        type: 'object' as const,
        properties: {
          path: string('The file, absolute or relative to where you run.'),
          caption: string('A line about the file.'),
        },
        required: ['path'],
      },
    },
    {
      name: 'notify',
      description: runner.describe('notify'),
      inputSchema: {
        type: 'object' as const,
        properties: { message: string('The line.') },
        required: ['message'],
      },
    },
  ];
  const mcp = new McpServer(
    { name: 'oppenheimer', version: '1.0.0' },
    { capabilities: { tools: {} }, instructions: runner.instructions },
  );
  mcp.server.setRequestHandler(ListToolsRequestSchema, async () => ({ tools }));
  mcp.server.setRequestHandler(CallToolRequestSchema, async (received) => {
    const name = received.params.name;
    used.push(`mcp:${name}`);
    if (name !== 'show_visual') return { content: [{ type: 'text' as const, text: 'done' }] };
    const input = (received.params.arguments ?? {}) as Record<string, unknown>;
    const spec = { title: input.title, subtitle: input.subtitle, blocks: input.blocks };
    const parsed = parseVisual(spec);
    shown.push({
      via: 'mcp',
      ok: parsed.ok,
      spec,
      ...(parsed.ok ? {} : { errors: parsed.errors }),
    });
    return parsed.ok
      ? {
          content: [
            {
              type: 'text' as const,
              text: `shown in the chat: ${JSON.stringify(parsed.visual.title)}, ${parsed.visual.blocks.length} blocks; do not repeat its numbers, say what they mean`,
            },
          ],
        }
      : {
          content: [
            {
              type: 'text' as const,
              text: `SESS_023 The visual cannot be shown: ${parsed.errors.join('; ')}`,
            },
          ],
          isError: true,
        };
  });

  const said: string[] = [];
  let stopped: string | undefined;
  try {
    for await (const message of query({
      prompt: c.task,
      options: {
        model,
        systemPrompt: { type: 'preset', preset: 'claude_code' },
        cwd,
        allowedTools: [
          'Bash',
          'Read',
          'Glob',
          'Grep',
          'Edit',
          'Write',
          ...tools.map((tool) => `mcp__oppenheimer__${tool.name}`),
        ],
        env: { ...process.env, PATH: `${join(root, 'bin')}:${process.env.PATH ?? ''}` },
        permissionMode: 'dontAsk',
        mcpServers: { oppenheimer: { type: 'sdk', name: 'oppenheimer', instance: mcp } },
        strictMcpConfig: true,
        settingSources: [],
        persistSession: false,
        maxTurns: MAX_TURNS,
      },
    })) {
      if (message.type === 'assistant') {
        for (const block of message.message.content) {
          if (block.type === 'text') said.push(block.text);
        }
      } else if (message.type === 'result' && message.subtype !== 'success') {
        stopped = message.subtype;
      }
    }
  } catch (error) {
    stopped = String(error);
  }
  let readSkill = false;
  for (const line of readFileSync(log, 'utf8').split('\n').filter(Boolean)) {
    const entry = JSON.parse(line) as {
      kind: string;
      ok?: boolean;
      spec?: unknown;
      errors?: string[];
      args?: string[];
    };
    if (entry.kind === 'skill') readSkill = true;
    if (entry.kind === 'show') {
      used.push('cli:sessions show');
      shown.push({ via: 'cli', ok: entry.ok === true, spec: entry.spec, errors: entry.errors });
    }
    if (entry.kind === 'command') used.push(`cli:${(entry.args ?? []).slice(0, 2).join(' ')}`);
  }
  rmSync(root, { recursive: true, force: true });
  return { shown, used, readSkill, answer: said.join('\n'), ...(stopped ? { stopped } : {}) };
}

function scoreRun(run: Run, c: Case) {
  const ok = run.shown.filter((s) => s.ok);
  const firstTry = run.shown.length === 0 ? null : run.shown[0]?.ok === true;
  const echoed = echoedNumbers(
    ok.map((s) => s.spec),
    run.answer,
  );
  // A run that failed or hit its cap did not do the task: it is never right.
  const right = !run.stopped && (c.expect === 'visual' ? ok.length > 0 : run.shown.length === 0);
  const mark = run.stopped
    ? '!'
    : c.expect === 'visual'
      ? ok.length > 0
        ? ok[0]?.via === 'mcp'
          ? 'M'
          : 'C'
        : run.shown.length
          ? 'e'
          : '-'
      : run.shown.length
        ? 'x'
        : '.';
  const note = `${run.shown.map((s) => `${s.via}:${s.ok ? 'shown' : `refused (${s.errors?.join('; ').slice(0, 120)})`}`).join(', ') || 'no visual'}; skill ${run.readSkill ? 'read' : 'unread'}; used [${run.used.join(', ')}]; said: ${run.answer.replace(/\s+/g, ' ').slice(0, 160) || '(nothing)'}`;
  return { right, mark, firstTry, echoed, note };
}

async function main(): Promise<void> {
  // biome-ignore lint/suspicious/noUndeclaredEnvVars: a root script, not a Turborepo task — nothing caches its output.
  const model = process.env.AGENTIC_UI_SESSION_MODEL ?? 'claude-sonnet-5-5';
  const runs = Number(arg('runs') ?? 3);
  const only = arg('case');
  const file = JSON.parse(readFileSync(join(HERE, 'sessions.json'), 'utf8')) as { cases: Case[] };
  const chosen = file.cases.filter((c) => !only || c.id === only);
  if (chosen.length === 0) throw new Error(`No case "${only}".`);
  const jobs = chosen.flatMap((c) => Array.from({ length: runs }, () => c));
  const done = await pool(jobs, MAX_PARALLEL, (c) => runCase(c, model));
  const results = chosen.map((c, i) => {
    const caseRuns = done.slice(i * runs, (i + 1) * runs);
    const scores = caseRuns.map((run) => scoreRun(run, c));
    const right = scores.filter((s) => s.right).length;
    return { ...c, runs: caseRuns, scores, right, passed: right * 2 > runs };
  });

  const width = Math.max(...results.map((r) => r.id.length));
  for (const r of results) {
    console.log(
      `${r.passed ? 'pass' : 'FAIL'}  ${r.id.padEnd(width)}  want ${r.expect.padEnd(9)}  got ${r.scores.map((s) => s.mark).join('')}  ${r.right}/${runs}`,
    );
    r.scores.forEach((score, at) => {
      const run = r.runs[at] as Run;
      if (!score.right || score.firstTry === false || score.echoed >= 3) {
        console.log(
          `        ${score.right ? 'ok ' : 'BAD'} ${score.note}${score.echoed >= 3 ? ` [echoed ${score.echoed} numbers]` : ''}${run.stopped ? ` [${run.stopped}]` : ''}`,
        );
      }
    });
  }
  const all = results.flatMap((r) => r.scores);
  const sent = all.filter((s) => s.firstTry !== null);
  const right = all.filter((s) => s.right).length;
  const failed = results.filter((r) => !r.passed).length;
  const skills = results.flatMap((r) => r.runs).filter((run) => run.readSkill).length;
  console.log(
    `\n${model} (claude-code, session): ${right}/${all.length} runs right; first visual parsed in ${sent.filter((s) => s.firstTry).length}/${sent.length}; ${all.filter((s) => s.echoed >= 3).length} answer(s) repeated 3+ of the visual's numbers; read the manual in ${skills}/${all.length}; ${failed} of ${results.length} cases failed.`,
  );
  console.log(`Report: ${writeReport(HERE, { lane: 'sessions', model, runs, results })}`);
  process.exit(failed === 0 ? 0 : 1);
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(2);
});
