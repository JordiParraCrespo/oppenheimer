#!/usr/bin/env node
// Oppenheimer's hook for a Claude Code cloud session: its chat in the
// console, both ways (`product/next-steps/cloud-agents.md`, "The chat of a
// cloud session"). One file, two hooks, in the repository's
// `.claude/settings.json`:
//
//   SessionStart: node .claude/hooks/oppenheimer-cloud-chat.mjs session-start
//   Stop:         node .claude/hooks/oppenheimer-cloud-chat.mjs stop
//
// `session-start` starts a streamer that follows the session's transcript (the
// file Claude Code names on the hook's stdin) and posts each complete line to
// the API. `stop` collects a reply typed in the console when the agent ends a
// turn and hands it back as the hook's block decision, so the agent carries
// on with it.
//
// Reads OPPENHEIMER_URL (the API's address) and OPPENHEIMER_CLOUD_KEY (a
// token with cloud-chat:write, from the session's pane in the console), and
// OPPENHEIMER_REPLY_WAIT (seconds the Stop hook waits for a reply, default 30,
// at most 120). Without the first two it does nothing. It never fails the
// session: whatever happens it exits 0.
import { spawn } from 'node:child_process';
import {
  closeSync,
  existsSync,
  mkdirSync,
  openSync,
  readFileSync,
  readSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const STATE_DIR = join(tmpdir(), 'oppenheimer-cloud-chat');
const POLL_MS = 300;
const MAX_BACKOFF_MS = 10_000;
/** A request's body, at most: the API takes about 100 KB. */
const BATCH_BYTES = 90_000;
/** One line, at most (`MAX_CLOUD_TRANSCRIPT_LINE_BYTES` in @oppenheimer/shared). */
const MAX_LINE_BYTES = 64_000;
/** How long a string in a line too large may stay. */
const KEEP_CHARS = 4_000;
const TOO_LARGE = JSON.stringify({
  type: 'system',
  content: '(a transcript line too large to send)',
});
/** A transcript that has not grown for this long, whose agent is gone, is finished. */
const IDLE_EXIT_MS = 10 * 60_000;

/**
 * The complete lines at the front of `buffer`, and what is left after them:
 * the agent may be halfway through writing the last line.
 */
export function takeCompleteLines(buffer) {
  const cut = buffer.lastIndexOf('\n');
  if (cut < 0) return { lines: [], rest: buffer };
  return { lines: buffer.slice(0, cut).split('\n'), rest: buffer.slice(cut + 1) };
}

/**
 * A line the API will take: as it is when it fits, else with every long
 * string in it cut short (a tool's output, a file it read), else a stand-in
 * that says a line was there. Its number is kept either way.
 */
export function fitLine(line) {
  if (Buffer.byteLength(line) <= MAX_LINE_BYTES) return line;
  const cut = (value) => {
    if (typeof value === 'string') {
      return value.length > KEEP_CHARS ? `${value.slice(0, KEEP_CHARS)}… [cut short]` : value;
    }
    if (Array.isArray(value)) return value.map(cut);
    if (value && typeof value === 'object') {
      return Object.fromEntries(Object.entries(value).map(([key, inner]) => [key, cut(inner)]));
    }
    return value;
  };
  try {
    const shorter = JSON.stringify(cut(JSON.parse(line)));
    return Buffer.byteLength(shorter) <= MAX_LINE_BYTES ? shorter : TOO_LARGE;
  } catch {
    return TOO_LARGE;
  }
}

/** The raw lines at the front of `lines` that fit one request: at least one. */
function takeBatch(lines) {
  let bytes = 0;
  let count = 0;
  for (const line of lines) {
    const size = line ? Buffer.byteLength(fitLine(line)) + 4 : 0;
    if (count > 0 && bytes + size > BATCH_BYTES) break;
    bytes += size;
    count++;
  }
  return lines.slice(0, count);
}

async function start() {
  const { OPPENHEIMER_URL: url, OPPENHEIMER_CLOUD_KEY: key } = process.env;
  if (!url || !key) return;
  const input = JSON.parse(readFileSync(0, 'utf8') || '{}');
  if (!input.transcript_path) return;

  mkdirSync(STATE_DIR, { recursive: true });
  const job = {
    url,
    key,
    transcript: input.transcript_path,
    session: sessionKey(input),
    // Claude Code's pid when it says so (CLAUDE_PID in a cloud session);
    // otherwise the streamer ends on an idle transcript alone.
    agentPid: Number(process.env.CLAUDE_PID) || null,
  };

  // One streamer per transcript: a resume runs this hook again.
  const lock = join(STATE_DIR, `${job.session}.pid`);
  if (existsSync(lock) && alive(Number(readFileSync(lock, 'utf8')))) return;

  const child = spawn(
    process.execPath,
    [fileURLToPath(import.meta.url), '--follow', JSON.stringify(job)],
    { detached: true, stdio: 'ignore' },
  );
  writeFileSync(lock, String(child.pid));
  child.unref();
  console.log(`Streaming this session to Oppenheimer as ${job.session}.`);
}

function alive(pid) {
  if (!pid) return false;
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

/** The bytes the transcript gained since `offset`, as text. */
function readFrom(path, offset) {
  const size = existsSync(path) ? statSync(path).size : 0;
  if (size <= offset) return { text: '', size: offset };
  const fd = openSync(path, 'r');
  const buffer = Buffer.alloc(size - offset);
  readSync(fd, buffer, 0, buffer.length, offset);
  closeSync(fd);
  return { text: buffer.toString('utf8'), size };
}

/**
 * Read what was added, post the complete lines, remember how far the server
 * has them: the bytes of the file it holds, and how many lines that is, which
 * numbers the next batch. `unsent` holds raw lines the server has not taken
 * yet, so a refusal keeps them as they were read and nothing is ever dropped.
 */
async function followTranscript(job) {
  const stateFile = join(STATE_DIR, `${job.session}.sent.json`);
  // Where the server's copy ends: every byte and line before it was accepted.
  let sent = { bytes: 0, lines: 0 };
  try {
    sent = JSON.parse(readFileSync(stateFile, 'utf8'));
  } catch {}
  let readTo = sent.bytes;
  let partial = '';
  let unsent = [];
  let lastGrowth = Date.now();
  let backoff = POLL_MS;

  for (;;) {
    const read = readFrom(job.transcript, readTo);
    if (read.size > readTo) {
      readTo = read.size;
      lastGrowth = Date.now();
      const { lines, rest } = takeCompleteLines(partial + read.text);
      unsent = unsent.concat(lines);
      partial = rest;
    }

    while (unsent.length > 0) {
      const batch = takeBatch(unsent);
      const lines = batch.filter(Boolean).map(fitLine);
      if (lines.length > 0 && !(await post(job, sent.lines, lines))) break;
      unsent = unsent.slice(batch.length);
      sent = {
        bytes: sent.bytes + batch.reduce((bytes, line) => bytes + Buffer.byteLength(line) + 1, 0),
        lines: sent.lines + lines.length,
      };
      writeFileSync(stateFile, JSON.stringify(sent));
    }
    backoff = unsent.length > 0 ? Math.min(backoff * 2, MAX_BACKOFF_MS) : POLL_MS;

    const agentGone = job.agentPid ? !alive(job.agentPid) : true;
    if (agentGone && Date.now() - lastGrowth > IDLE_EXIT_MS) return;
    await new Promise((resolve) => setTimeout(resolve, backoff));
  }
}

/**
 * Sends lines numbered `from` on; whether the API has them. Anything else is
 * tried again later: no network, a rate limit, a session the console has not
 * learned of yet. The lines stay unsent meanwhile, never dropped.
 */
async function post(job, from, lines) {
  try {
    const response = await fetch(`${job.url}/api/v1/sessions/cloud-transcript`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${job.key}` },
      body: JSON.stringify({ cloudSessionId: job.session, from, lines }),
      signal: AbortSignal.timeout(10_000),
    });
    return response.ok;
  } catch {
    return false;
  }
}

/**
 * The session id both hooks send, as Claude Code hands it over: in a cloud
 * session the one claude.ai knows it by (`CLAUDE_CODE_REMOTE_SESSION_ID`,
 * `cse_…`), elsewhere Claude Code's own (`session_id` on the hook's stdin).
 * The server maps it to the console's id; the hooks know no prefixes.
 */
export function sessionKey(input, env = process.env) {
  return env.CLAUDE_CODE_REMOTE_SESSION_ID || input.session_id;
}

async function stop() {
  const { OPPENHEIMER_URL: url, OPPENHEIMER_CLOUD_KEY: key } = process.env;
  if (!url || !key) return;
  const input = JSON.parse(readFileSync(0, 'utf8') || '{}');
  const wait = Math.max(0, Math.min(Number(process.env.OPPENHEIMER_REPLY_WAIT ?? 30), 120));

  const response = await fetch(`${url}/api/v1/sessions/cloud-replies/take`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: `Bearer ${key}` },
    body: JSON.stringify({ cloudSessionId: sessionKey(input), wait }),
    signal: AbortSignal.timeout((wait + 10) * 1000),
  });
  if (!response.ok) return;
  const { text } = await response.json();
  if (!text) return;

  process.stdout.write(
    JSON.stringify({
      decision: 'block',
      // The console reads a "Stop hook feedback" line carrying this first line
      // as the person's message (CLOUD_REPLY_PREAMBLE in @oppenheimer/shared).
      reason: `The person following this session in Oppenheimer replied:\n\n${text}`,
    }),
  );
}

const mode = process.argv[2];
const isEntry = process.argv[1] === fileURLToPath(import.meta.url);
if (isEntry && mode === '--follow') {
  followTranscript(JSON.parse(process.argv[3])).catch(() => {});
} else if (isEntry) {
  (mode === 'stop' ? stop() : start()).catch(() => {}).finally(() => process.exit(0));
}
