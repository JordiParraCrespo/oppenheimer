#!/usr/bin/env node
// SessionStart hook: start the streamer that sends this session's transcript
// to Oppenheimer, and return at once. Claude Code waits for a SessionStart
// hook, so the streamer runs as a detached child that outlives it.
//
// Claude Code hands every hook the transcript's path and the session's id on
// stdin. The streamer follows that file, the same JSONL the runner reads for a
// host session's chat view, and posts each complete line it has not sent yet.
//
// Needs OPPENHEIMER_URL and OPPENHEIMER_CLOUD_KEY; without them it does
// nothing. It never fails the session: whatever happens it exits 0.
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
import { sessionKey } from './session-key.mjs';

const STATE_DIR = join(tmpdir(), 'oppenheimer-cloud-chat');
const POLL_MS = 300;
const MAX_BACKOFF_MS = 10_000;
const BATCH_LINES = 200;
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

/** A transcript line as the server takes it; a line that is not JSON goes as it is. */
function parseLine(raw) {
  try {
    return JSON.parse(raw);
  } catch {
    return { type: 'unparsed', raw };
  }
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
 * has them. `unsent` holds raw lines the server has not taken yet, so a
 * refusal keeps them as they were read and nothing is ever dropped.
 */
async function followTranscript(job) {
  const offsetFile = join(STATE_DIR, `${job.session}.offset`);
  // Where the server's copy ends: every byte before it has been accepted.
  let sentTo = existsSync(offsetFile) ? Number(readFileSync(offsetFile, 'utf8')) || 0 : 0;
  let readTo = sentTo;
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
      const batch = unsent.slice(0, BATCH_LINES);
      if (!(await post(job, batch.filter(Boolean).map(parseLine)))) break;
      unsent = unsent.slice(batch.length);
      sentTo += batch.reduce((bytes, line) => bytes + Buffer.byteLength(line) + 1, 0);
      writeFileSync(offsetFile, String(sentTo));
    }
    backoff = unsent.length > 0 ? Math.min(backoff * 2, MAX_BACKOFF_MS) : POLL_MS;

    const agentGone = job.agentPid ? !alive(job.agentPid) : true;
    if (agentGone && Date.now() - lastGrowth > IDLE_EXIT_MS) return;
    await new Promise((resolve) => setTimeout(resolve, backoff));
  }
}

async function post(job, lines) {
  try {
    const response = await fetch(`${job.url}/api/sessions/${job.session}/transcript`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${job.key}` },
      body: JSON.stringify({ lines }),
      signal: AbortSignal.timeout(10_000),
    });
    return response.ok;
  } catch {
    return false;
  }
}

const isEntry = process.argv[1] === fileURLToPath(import.meta.url);
if (isEntry && process.argv[2] === '--follow') {
  followTranscript(JSON.parse(process.argv[3])).catch(() => {});
} else if (isEntry) {
  start()
    .catch(() => {})
    .finally(() => process.exit(0));
}
