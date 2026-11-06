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
const BATCH_LINES = 200;
/** A transcript that has not grown for this long, whose agent is gone, is finished. */
const IDLE_EXIT_MS = 10 * 60_000;

async function main() {
  const follow = process.argv[2] === '--follow';
  if (follow) return followTranscript(JSON.parse(process.argv[3]));

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
    {
      detached: true,
      stdio: 'ignore',
    },
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

async function followTranscript(job) {
  const offsetFile = join(STATE_DIR, `${job.session}.offset`);
  let offset = existsSync(offsetFile) ? Number(readFileSync(offsetFile, 'utf8')) || 0 : 0;
  let pending = '';
  let lastGrowth = Date.now();
  let backoff = POLL_MS;

  for (;;) {
    const size = existsSync(job.transcript) ? statSync(job.transcript).size : 0;
    if (size > offset) {
      const fd = openSync(job.transcript, 'r');
      const buffer = Buffer.alloc(size - offset);
      readSync(fd, buffer, 0, buffer.length, offset);
      closeSync(fd);
      pending += buffer.toString('utf8');
      offset = size;
      lastGrowth = Date.now();
    }

    // Only whole lines: the agent may be halfway through writing the last one.
    const cut = pending.lastIndexOf('\n');
    if (cut >= 0) {
      const lines = pending
        .slice(0, cut)
        .split('\n')
        .filter(Boolean)
        .map((raw) => {
          try {
            return JSON.parse(raw);
          } catch {
            return { type: 'unparsed', raw };
          }
        });
      let sent = 0;
      while (sent < lines.length) {
        const batch = lines.slice(sent, sent + BATCH_LINES);
        if (!(await post(job, batch))) break;
        sent += batch.length;
      }
      if (sent === lines.length) {
        pending = pending.slice(cut + 1);
        writeFileSync(offsetFile, String(offset - Buffer.byteLength(pending)));
        backoff = POLL_MS;
      } else {
        // Keep what was not accepted and try again later; never drop a line.
        const unsent = lines
          .slice(sent)
          .map((line) => (line.type === 'unparsed' ? line.raw : JSON.stringify(line)))
          .join('\n');
        pending = `${unsent}\n${pending.slice(cut + 1)}`;
        backoff = Math.min(backoff * 2, 10_000);
      }
    }

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

main()
  .catch(() => {})
  .finally(() => {
    if (process.argv[2] !== '--follow') process.exit(0);
  });
