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
      const batch = unsent.slice(0, BATCH_LINES);
      const lines = batch.filter(Boolean);
      const outcome = lines.length === 0 ? 'stored' : await post(job, sent.lines, lines);
      if (outcome === 'retry') break;
      unsent = unsent.slice(batch.length);
      sent = {
        bytes: sent.bytes + batch.reduce((bytes, line) => bytes + Buffer.byteLength(line) + 1, 0),
        // A batch refused for good is skipped, and its numbers with it, so
        // the lines after it keep the numbers they have in the file.
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
 * Sends lines numbered `from` on. `stored` once the API has them; `refused`
 * when it never will (a line too large, a malformed batch), so the streamer
 * moves past them; `retry` for anything that may pass later: no network, a
 * rate limit, a session the console has not learned of yet.
 */
async function post(job, from, lines) {
  try {
    const response = await fetch(`${job.url}/api/v1/sessions/cloud-transcript`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${job.key}` },
      body: JSON.stringify({ cloudSessionId: job.session, from, lines }),
      signal: AbortSignal.timeout(10_000),
    });
    if (response.ok) return 'stored';
    return response.status === 400 || response.status === 413 ? 'refused' : 'retry';
  } catch {
    return 'retry';
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
