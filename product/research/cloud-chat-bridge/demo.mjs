#!/usr/bin/env node
// The whole loop, end to end, with a real `claude` process:
//
//   1. starts server.mjs (the stand-in for Oppenheimer's API and chat);
//   2. makes a scratch project whose .claude/settings.json carries the two
//      hooks, as a repository's would;
//   3. runs `claude -p` there with a first task;
//   4. as the person in the chat, sends a reply while the agent is still on
//      the first task;
//   5. checks the agent did both: the reply reached it through the Stop hook.
//
//   node demo.mjs [--keep]     --keep leaves the server up to look at the chat
import { spawn } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const PORT = 4790;
const KEY = 'opp_cloud_demo';
const URL_BASE = `http://127.0.0.1:${PORT}`;
const keep = process.argv.includes('--keep');

const server = spawn(
  process.execPath,
  [join(here, 'server.mjs'), '--port', String(PORT), '--key', KEY],
  {
    stdio: ['ignore', 'pipe', 'inherit'],
  },
);
await new Promise((resolve) => server.stdout.once('data', resolve));
console.log(`server up: ${URL_BASE}/?key=${KEY}`);

const project = mkdtempSync(join(process.env.DEMO_DIR ?? tmpdir(), 'cloud-chat-demo-'));
mkdirSync(join(project, '.claude'));
writeFileSync(
  join(project, '.claude', 'settings.json'),
  JSON.stringify(
    {
      hooks: {
        SessionStart: [
          {
            hooks: [
              {
                type: 'command',
                command: `node ${join(here, 'hooks', 'session-start.mjs')}`,
                timeout: 10,
              },
            ],
          },
        ],
        Stop: [
          {
            hooks: [
              { type: 'command', command: `node ${join(here, 'hooks', 'stop.mjs')}`, timeout: 120 },
            ],
          },
        ],
      },
    },
    null,
    2,
  ),
);
console.log(`project: ${project}`);

// The nested agent is its own session: it must not borrow this cloud
// session's identity (the hooks would stream under its id). It keeps the rest
// of the environment, which is how it reaches the model from in here.
const env = {
  ...process.env,
  OPPENHEIMER_URL: URL_BASE,
  OPPENHEIMER_CLOUD_KEY: KEY,
  OPPENHEIMER_REPLY_WAIT: '15',
};
for (const name of [
  'CLAUDE_CODE_REMOTE_SESSION_ID',
  'CLAUDE_PID',
  'CLAUDE_CODE_MESSAGING_SOCKET',
  'CLAUDE_CODE_MESSAGING_TOKEN',
]) {
  delete env[name];
}

const sessionId = randomUUID();
const task =
  'Create a file named notes.txt containing exactly the line ALPHA. Then run `sleep 8` in the shell. Then say "first task done".';
const agent = spawn(
  'claude',
  // Default permissions, with only what the two tasks need allowed.
  [
    '-p',
    task,
    // Named here, as the launch path names a cloud session, so nothing has to
    // find it afterwards.
    '--session-id',
    sessionId,
    '--allowedTools',
    'Write',
    'Edit',
    'Read',
    'Bash(sleep *)',
    '--output-format',
    'json',
  ],
  { cwd: project, env, stdio: ['ignore', 'pipe', 'inherit'] },
);
let output = '';
agent.stdout.on('data', (chunk) => (output += chunk));

// The person, watching the chat: once the agent is under way, reply.
const auth = { authorization: `Bearer ${KEY}`, 'content-type': 'application/json' };
let streamed = 0;
for (let i = 0; i < 120 && streamed === 0; i++) {
  await new Promise((resolve) => setTimeout(resolve, 1000));
  const sessions = await (await fetch(`${URL_BASE}/api/sessions`, { headers: auth })).json();
  streamed = sessions.find((s) => s.id === sessionId)?.lines ?? 0;
}
if (streamed === 0) throw new Error('no transcript reached the server');
console.log(`streaming: session ${sessionId}`);

const reply = 'Thanks. Now append a second line, BRAVO, to notes.txt and say "second task done".';
await fetch(`${URL_BASE}/api/sessions/${sessionId}/replies`, {
  method: 'POST',
  headers: auth,
  body: JSON.stringify({ text: reply }),
});
console.log(`replied while the agent works: ${reply}`);

const code = await new Promise((resolve) => agent.on('close', resolve));
// Let the streamer post the last lines.
await new Promise((resolve) => setTimeout(resolve, 2000));

const notes = existsSync(join(project, 'notes.txt'))
  ? readFileSync(join(project, 'notes.txt'), 'utf8')
  : '';
const sessions = await (await fetch(`${URL_BASE}/api/sessions`, { headers: auth })).json();
const lines = sessions.find((s) => s.id === sessionId)?.lines ?? 0;
let result = '';
try {
  result = JSON.parse(output).result ?? '';
} catch {}

const checks = [
  ['claude exited 0', code === 0],
  ['transcript lines streamed', lines > 0],
  ['first task done (ALPHA)', /^ALPHA$/m.test(notes)],
  ['reply reached the agent (BRAVO)', /^BRAVO$/m.test(notes)],
];
console.log(`\nnotes.txt:\n${notes}`);
console.log(`final answer: ${result}`);
console.log(`lines streamed: ${lines}\n`);
for (const [name, ok] of checks) console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}`);
const passed = checks.every(([, ok]) => ok);

if (keep) {
  console.log(`\nchat: ${URL_BASE}/?key=${KEY}&session=${sessionId}  (Ctrl-C to stop)`);
} else {
  server.kill();
  process.exit(passed ? 0 : 1);
}
