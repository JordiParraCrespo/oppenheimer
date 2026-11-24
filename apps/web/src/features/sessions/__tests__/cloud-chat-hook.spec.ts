// @vitest-environment node
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

/** The hook the console hands out, as a cloud session runs it; plain JavaScript, so typed here. */
type CloudChatHook = {
  outcomeOf(status: number): 'sent' | 'retry' | 'refused';
  followTranscript(job: {
    url: string;
    key: string;
    transcript: string;
    session: string;
    agentPid: number | null;
  }): Promise<void>;
};
const { followTranscript, outcomeOf }: CloudChatHook = await import(
  '../../../../public/cloud-chat-hook.mjs' as string
);

const MINUTE = 60_000;
/** Where the streamer keeps its offsets; `session-start` makes it before it spawns one. */
const STATE_DIR = join(tmpdir(), 'oppenheimer-cloud-chat');

describe('outcomeOf', () => {
  it('reads an answer the same request gets again as a refusal, and a passing failure as one to retry', () => {
    // Breaks if a 404 (a session this workspace did not launch) is retried
    // forever again, or if a rate limit or an outage ends the streamer.
    expect([200, 204].map(outcomeOf)).toEqual(['sent', 'sent']);
    expect([400, 401, 403, 404, 413].map(outcomeOf)).toEqual(Array(5).fill('refused'));
    expect([408, 425, 429, 500, 502, 503].map(outcomeOf)).toEqual(Array(6).fill('retry'));
  });
});

describe('followTranscript', () => {
  let dir: string;
  let agentAlive: boolean;
  let statuses: number[];
  let posted: { from: number; lines: string[] }[];
  let fetchMock: ReturnType<typeof vi.fn>;
  let sessions: string[];

  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'Date'] });
    dir = mkdtempSync(join(tmpdir(), 'cloud-chat-hook-'));
    mkdirSync(STATE_DIR, { recursive: true });
    sessions = [];
    agentAlive = true;
    posted = [];
    statuses = [];
    // The agent's pid is checked with signal 0; nothing is ever signalled.
    vi.spyOn(process, 'kill').mockImplementation(() => {
      if (!agentAlive) throw new Error('ESRCH');
      return true;
    });
    fetchMock = vi.fn(async (_url: string, init: RequestInit) => {
      posted.push(JSON.parse(String(init.body)));
      const status = statuses.length > 1 ? (statuses.shift() as number) : statuses[0];
      return new Response(null, { status });
    });
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
    rmSync(dir, { recursive: true, force: true });
    for (const session of sessions)
      rmSync(join(STATE_DIR, `${session}.sent.json`), { force: true });
  });

  function newSession() {
    const session = `session_${Math.random().toString(36).slice(2, 14)}`;
    sessions.push(session);
    return session;
  }

  function follow(answers: number[]) {
    statuses = answers;
    const transcript = join(dir, 'transcript.jsonl');
    writeFileSync(transcript, '{"type":"user"}\n{"type":"assistant"}\n');
    let finished = false;
    const run = followTranscript({
      url: 'https://api.example.test',
      key: 'opp_key',
      transcript,
      // Unique per run: the streamer keeps its offset under this name.
      session: newSession(),
      agentPid: 4242,
    }).then(() => {
      finished = true;
    });
    return { run, isFinished: () => finished };
  }

  it('stops a streamer whose session the API keeps refusing, after a bounded number of posts', async () => {
    // Breaks if a 404 that never clears is retried for as long as the agent
    // runs: about six posts a minute, without end.
    const streamer = follow([404]);
    await vi.advanceTimersByTimeAsync(9 * MINUTE);
    expect(streamer.isFinished()).toBe(false);
    await vi.advanceTimersByTimeAsync(2 * MINUTE);
    expect(streamer.isFinished()).toBe(true);
    expect(fetchMock.mock.calls.length).toBeLessThan(80);
    await streamer.run;
  });

  it('delivers the lines of a session the console learns of a little late', async () => {
    // Breaks if the first 404s of a session just launched (its host has not
    // reported its id yet) end the streamer before the session is known.
    const streamer = follow([...Array(12).fill(404), 200]);
    await vi.advanceTimersByTimeAsync(15 * MINUTE);
    expect(streamer.isFinished()).toBe(false);
    expect(posted.at(-1)).toMatchObject({
      from: 0,
      lines: ['{"type":"user"}', '{"type":"assistant"}'],
    });
    expect(fetchMock).toHaveBeenCalledTimes(13);

    agentAlive = false;
    await vi.advanceTimersByTimeAsync(11 * MINUTE);
    expect(streamer.isFinished()).toBe(true);
    await streamer.run;
  });

  it('keeps retrying through an outage and a rate limit, and delivers once the API is back', async () => {
    // Breaks if a failure that passes on its own is read as final and the
    // streamer gives up on a session the console is following.
    const outage = Array(150).fill(503).concat(Array(20).fill(429));
    const streamer = follow([...outage, 200]);
    await vi.advanceTimersByTimeAsync(40 * MINUTE);
    expect(streamer.isFinished()).toBe(false);
    expect(fetchMock).toHaveBeenCalledTimes(outage.length + 1);
    expect(posted.at(-1)).toMatchObject({
      from: 0,
      lines: ['{"type":"user"}', '{"type":"assistant"}'],
    });

    agentAlive = false;
    await vi.advanceTimersByTimeAsync(11 * MINUTE);
    await streamer.run;
  });

  it('starts the refusal clock again after a post is accepted', async () => {
    // Breaks if refusals on either side of an accepted post add up, ending
    // the streamer of a session that is known.
    statuses = [...Array(40).fill(404), 200, ...Array(40).fill(404), 200];
    const transcript = join(dir, 'transcript.jsonl');
    writeFileSync(transcript, '{"type":"user"}\n');
    let finished = false;
    const run = followTranscript({
      url: 'https://api.example.test',
      key: 'opp_key',
      transcript,
      session: newSession(),
      agentPid: 4242,
    }).then(() => {
      finished = true;
    });
    // Forty refusals at ten seconds each are under the limit; the next line
    // arrives once the first is accepted.
    await vi.advanceTimersByTimeAsync(8 * MINUTE);
    expect(fetchMock).toHaveBeenCalledTimes(41);
    writeFileSync(transcript, '{"type":"user"}\n{"type":"assistant"}\n');
    await vi.advanceTimersByTimeAsync(8 * MINUTE);
    expect(finished).toBe(false);
    expect(fetchMock).toHaveBeenCalledTimes(82);
    expect(posted.at(-1)).toMatchObject({ from: 1, lines: ['{"type":"assistant"}'] });

    agentAlive = false;
    await vi.advanceTimersByTimeAsync(11 * MINUTE);
    await run;
  });
});
