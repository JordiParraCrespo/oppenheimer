// A stand-in for the Oppenheimer API and the console's chat, for the proof of
// concept only: it keeps each session's transcript lines in memory, streams
// them to the chat page over server-sent events, and queues the replies typed
// there until the session's Stop hook collects one.
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
  },
});
const here = dirname(fileURLToPath(import.meta.url));
const page = readFileSync(join(here, 'index.html'));

/** @type {Map<string, {lines: object[], replies: string[], watchers: Set<import('node:http').ServerResponse>, waiters: Set<(text: string) => void>, sent: object[]}>} */
const sessions = new Map();

function session(id) {
  let found = sessions.get(id);
  if (!found) {
    found = { lines: [], replies: [], watchers: new Set(), waiters: new Set(), sent: [] };
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

function push(s, event) {
  const frame = `data: ${JSON.stringify(event)}\n\n`;
  for (const watcher of s.watchers) watcher.write(frame);
}

const server = createServer(async (req, res) => {
  const url = new URL(req.url ?? '/', 'http://localhost');
  if (url.pathname === '/' && req.method === 'GET') {
    res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
    res.end(page);
    return;
  }
  if (url.pathname === '/api/sessions' && req.method === 'GET') {
    if (!authorized(req, url)) return send(res, 401, { error: 'unauthorized' });
    return send(
      res,
      200,
      [...sessions.entries()].map(([id, s]) => ({ id, lines: s.lines.length })),
    );
  }

  const match = url.pathname.match(
    /^\/api\/sessions\/([\w-]{1,80})\/(transcript|events|replies|replies\/next)$/,
  );
  if (!match) return send(res, 404, { error: 'not found' });
  if (!authorized(req, url)) return send(res, 401, { error: 'unauthorized' });
  const [, id, route] = match;
  const s = session(id);

  try {
    // The streamer in the session: a batch of transcript lines, in order.
    if (route === 'transcript' && req.method === 'POST') {
      const body = await readJson(req);
      const lines = Array.isArray(body.lines) ? body.lines : [];
      for (const line of lines) {
        s.lines.push(line);
        push(s, { kind: 'line', line });
      }
      return send(res, 200, { accepted: lines.length, total: s.lines.length });
    }

    // The chat page: everything so far, then every new line and reply as it lands.
    if (route === 'events' && req.method === 'GET') {
      res.writeHead(200, {
        'content-type': 'text/event-stream',
        'cache-control': 'no-cache',
        connection: 'keep-alive',
      });
      // Replies sit in the conversation where they were sent, not after it.
      const history = [
        ...s.lines.map((line) => ({ at: line.timestamp ?? '', event: { kind: 'line', line } })),
        ...s.sent.map((reply) => ({ at: reply.at, event: reply })),
      ].sort((a, b) => (a.at < b.at ? -1 : a.at > b.at ? 1 : 0));
      for (const { event } of history) res.write(`data: ${JSON.stringify(event)}\n\n`);
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
      if (typeof text !== 'string' || !text.trim())
        return send(res, 400, { error: 'text required' });
      const reply = {
        kind: 'reply',
        text: text.trim(),
        state: 'queued',
        at: new Date().toISOString(),
      };
      s.sent.push(reply);
      push(s, reply);
      const waiter = s.waiters.values().next().value;
      if (waiter) {
        s.waiters.delete(waiter);
        waiter(reply.text);
      } else {
        s.replies.push(reply.text);
      }
      return send(res, 202, { queued: true });
    }

    // The Stop hook: the next reply, waiting up to `wait` seconds for one.
    if (route === 'replies/next' && req.method === 'GET') {
      const deliver = (text) => {
        const reply = s.sent.find((r) => r.text === text && r.state === 'queued');
        if (reply) {
          reply.state = 'delivered';
          push(s, { ...reply, kind: 'reply-delivered' });
        }
        send(res, 200, { text });
      };
      if (s.replies.length > 0) return deliver(s.replies.shift());
      const wait = Math.min(Number(url.searchParams.get('wait') ?? 0), 600) * 1000;
      if (wait <= 0) return send(res, 204, {});
      const timer = setTimeout(() => {
        s.waiters.delete(waiter);
        res.writeHead(204).end();
      }, wait);
      const waiter = (text) => {
        clearTimeout(timer);
        deliver(text);
      };
      s.waiters.add(waiter);
      req.on('close', () => {
        clearTimeout(timer);
        s.waiters.delete(waiter);
      });
      return;
    }
  } catch (error) {
    return send(res, 400, { error: String(error.message ?? error) });
  }
  return send(res, 405, { error: 'method not allowed' });
});

function authorized(req, url) {
  const header = req.headers.authorization ?? '';
  return header === `Bearer ${values.key}` || url.searchParams.get('key') === values.key;
}

server.listen(Number(values.port), '127.0.0.1', () => {
  console.log(`cloud-chat-bridge listening on http://127.0.0.1:${values.port}/?key=${values.key}`);
});
