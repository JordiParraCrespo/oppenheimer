// A stand-in for the Oppenheimer API and the console's chat, for the proof of
// concept only: it keeps each session's transcript lines and replies in
// memory, streams both to the chat page over server-sent events, and hands
// the Stop hook the oldest reply nobody has collected.
//
//   node server.mjs [--port 4790] [--key opp_cloud_demo]
//
// Every /api route wants `Authorization: Bearer <key>`, as a cloud key would.
// The page gets the key in its URL (`/?key=…`), which is fine for a demo and
// nothing else.
import { readFileSync } from 'node:fs';
import { createServer } from 'node:http';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';

const { values } = parseArgs({
  options: {
    port: { type: 'string', default: '4790' },
    key: { type: 'string', default: 'opp_cloud_demo' },
    host: { type: 'string', default: '127.0.0.1' },
    // Hand the key to the page itself, so `/` opens signed in: for a preview
    // on the same machine only.
    'embed-key': { type: 'boolean', default: false },
  },
});
const here = dirname(fileURLToPath(import.meta.url));

/**
 * A reply typed in the chat: `queued` until a Stop hook collects it, then
 * `delivered`. One ordered list per session is the whole state: the page
 * draws it and the Stop hook takes the oldest queued one.
 * @typedef {{ id: number, text: string, at: string, state: 'queued' | 'delivered' }} Reply
 */

/** @type {Map<string, { lines: object[], replies: Reply[], watchers: Set<import('node:http').ServerResponse>, wakers: Set<() => void> }>} */
const sessions = new Map();
let nextReplyId = 1;

/**
 * The one place a session's id is read. A cloud session's hooks send Claude
 * Code's `cse_…`; claude.ai and the console name the same session
 * `session_…` with the same suffix.
 */
function sessionIdOf(raw) {
  return raw.replace(/^cse_/, 'session_');
}

function session(id) {
  let found = sessions.get(id);
  if (!found) {
    found = { lines: [], replies: [], watchers: new Set(), wakers: new Set() };
    sessions.set(id, found);
  }
  return found;
}

function send(res, status, body) {
  res.writeHead(status, { 'content-type': 'application/json' });
  res.end(JSON.stringify(body));
}

async function readJson(req) {
  let raw = '';
  for await (const chunk of req) {
    raw += chunk;
    if (raw.length > 5_000_000) throw new Error('body too large');
  }
  return raw ? JSON.parse(raw) : {};
}

const frame = (event) => `data: ${JSON.stringify(event)}\n\n`;

function emit(s, event) {
  for (const watcher of s.watchers) watcher.write(frame(event));
}

/** The oldest queued reply, now delivered, or null. */
function collect(s) {
  const reply = s.replies.find((r) => r.state === 'queued');
  if (!reply) return null;
  reply.state = 'delivered';
  emit(s, { kind: 'reply', reply });
  return reply;
}

/** A transcript line as the page reads it; one that is not JSON goes as it is. */
function parseLine(raw) {
  try {
    return JSON.parse(raw);
  } catch {
    return { type: 'unparsed', raw };
  }
}

/** The Stop hook: the oldest queued reply, waiting up to `waitSeconds` for one. */
function takeReply(s, waitSeconds, req, res) {
  const now = collect(s);
  if (now) return send(res, 200, { text: now.text });
  const wait = Math.min(waitSeconds, 120) * 1000;
  if (wait <= 0) return send(res, 200, { text: null });
  const done = () => {
    clearTimeout(timer);
    s.wakers.delete(wake);
  };
  const wake = () => {
    const reply = collect(s);
    if (!reply) return;
    done();
    send(res, 200, { text: reply.text });
  };
  const timer = setTimeout(() => {
    done();
    send(res, 200, { text: null });
  }, wait);
  s.wakers.add(wake);
  req.on('close', done);
}

function authorized(req, url) {
  const header = req.headers.authorization ?? '';
  return header === `Bearer ${values.key}` || url.searchParams.get('key') === values.key;
}

const ROUTE = /^\/api\/sessions\/([\w-]{1,80})\/(events|replies)$/;

const server = createServer(async (req, res) => {
  const url = new URL(req.url ?? '/', 'http://localhost');
  if (url.pathname === '/' && req.method === 'GET') {
    res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
    const html = readFileSync(join(here, 'index.html'), 'utf8');
    res.end(
      values['embed-key']
        ? html.replace('<head>', `<head><meta name="opp-key" content="${values.key}" />`)
        : html,
    );
    return;
  }
  if (!authorized(req, url)) return send(res, 401, { error: 'unauthorized' });
  if (url.pathname === '/api/sessions' && req.method === 'GET') {
    return send(
      res,
      200,
      [...sessions.entries()].map(([id, s]) => ({ id, lines: s.lines.length })),
    );
  }

  // The two routes the hooks call, as the real API names them: the session
  // is in the body, as Claude Code hands it over.
  if (url.pathname === '/api/v1/sessions/cloud-transcript' && req.method === 'POST') {
    const body = await readJson(req).catch(() => ({}));
    if (typeof body.cloudSessionId !== 'string' || !Array.isArray(body.lines)) {
      return send(res, 400, { error: 'cloudSessionId and lines required' });
    }
    const s = session(sessionIdOf(body.cloudSessionId));
    const from = Number(body.from) || 0;
    let accepted = 0;
    body.lines.forEach((raw, index) => {
      // Numbered by the hook, so a batch sent again stores nothing twice.
      if (from + index < s.lines.length) return;
      const line = parseLine(raw);
      s.lines.push(line);
      emit(s, { kind: 'line', line });
      accepted++;
    });
    return send(res, 200, { accepted });
  }
  if (url.pathname === '/api/v1/sessions/cloud-replies/take' && req.method === 'POST') {
    const body = await readJson(req).catch(() => ({}));
    if (typeof body.cloudSessionId !== 'string') {
      return send(res, 400, { error: 'cloudSessionId required' });
    }
    return takeReply(session(sessionIdOf(body.cloudSessionId)), Number(body.wait) || 0, req, res);
  }

  const match = url.pathname.match(ROUTE);
  if (!match) return send(res, 404, { error: 'not found' });
  const [, rawId, route] = match;
  const s = session(sessionIdOf(rawId));

  try {
    // The chat page: the conversation so far, replies where they were sent,
    // then every new line and every reply's change as it happens.
    if (route === 'events' && req.method === 'GET') {
      res.writeHead(200, {
        'content-type': 'text/event-stream',
        'cache-control': 'no-cache',
        connection: 'keep-alive',
      });
      const history = [
        ...s.lines.map((line) => ({ at: line.timestamp ?? '', event: { kind: 'line', line } })),
        ...s.replies.map((reply) => ({ at: reply.at, event: { kind: 'reply', reply } })),
      ].sort((a, b) => a.at.localeCompare(b.at));
      for (const { event } of history) res.write(frame(event));
      s.watchers.add(res);
      const ping = setInterval(() => res.write(': ping\n\n'), 15_000);
      req.on('close', () => {
        clearInterval(ping);
        s.watchers.delete(res);
      });
      return;
    }

    // The chat page: a reply for the session's agent.
    if (route === 'replies' && req.method === 'POST') {
      const { text } = await readJson(req);
      if (typeof text !== 'string' || !text.trim()) {
        return send(res, 400, { error: 'text required' });
      }
      const reply = {
        id: nextReplyId++,
        text: text.trim(),
        at: new Date().toISOString(),
        state: 'queued',
      };
      s.replies.push(reply);
      emit(s, { kind: 'reply', reply });
      for (const wake of s.wakers) wake();
      return send(res, 202, { id: reply.id });
    }
  } catch (error) {
    return send(res, 400, { error: String(error.message ?? error) });
  }
  return send(res, 405, { error: 'method not allowed' });
});

server.listen(Number(values.port), values.host, () => {
  console.log(`cloud-chat-bridge listening on http://127.0.0.1:${values.port}/?key=${values.key}`);
});
