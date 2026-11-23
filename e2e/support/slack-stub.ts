import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';

/**
 * A stand-in for Slack's Web API (`slack.com/api`), for a bot's own Slack app.
 *
 * It serves the two calls the API makes, in Slack's own shapes: `auth.test`
 * (who a bot token is) and `chat.postMessage` (an answer in a thread). A token
 * is accepted when it starts with {@link STUB_TOKEN_PREFIX}, and names the
 * workspace `T0STUB` and the bot user `U0<rest of the token>`; any other is
 * Slack's `invalid_auth`. Every post is kept, and `GET /_posts` answers them
 * oldest first, so a suite can see what the bot said and in which thread.
 * Events go the other way (Slack to the API) and are signed by the suite.
 */
export const STUB_TOKEN_PREFIX = 'xoxb-stub-';
export const STUB_TEAM_ID = 'T0STUB';

interface StubPost {
  channel: string;
  text: string;
  threadTs: string | null;
  ts: string;
  token: string;
}

function json(response: ServerResponse, status: number, body: unknown) {
  const payload = JSON.stringify(body);
  response.writeHead(status, {
    'content-type': 'application/json',
    'content-length': Buffer.byteLength(payload),
  });
  response.end(payload);
}

async function bodyOf(request: IncomingMessage): Promise<Record<string, unknown>> {
  let raw = '';
  for await (const chunk of request) raw += chunk;
  try {
    return raw ? (JSON.parse(raw) as Record<string, unknown>) : {};
  } catch {
    return {};
  }
}

/** The bot user a stub token names: the token's own suffix, so two tokens are two apps. */
function botUserOf(token: string): string {
  return `U0${
    token
      .slice(STUB_TOKEN_PREFIX.length)
      .replace(/[^A-Za-z0-9]/g, '')
      .toUpperCase()
      .slice(0, 20) || 'BOT'
  }`;
}

export async function startSlackStub(port: number) {
  const posts: StubPost[] = [];
  let clock = 1_700_000_000;
  const server = createServer(async (request, response) => {
    const path = new URL(request.url ?? '/', 'http://stub').pathname;
    if (request.method === 'GET' && path === '/_posts') return json(response, 200, posts);
    const token = (request.headers.authorization ?? '').replace(/^Bearer\s+/i, '');
    const body = await bodyOf(request);
    if (!token.startsWith(STUB_TOKEN_PREFIX)) {
      return json(response, 200, { ok: false, error: 'invalid_auth' });
    }
    if (path === '/auth.test') {
      return json(response, 200, {
        ok: true,
        team: 'Stub workspace',
        team_id: STUB_TEAM_ID,
        user: 'stub-bot',
        user_id: botUserOf(token),
        bot_id: 'B0STUB',
      });
    }
    if (path === '/chat.postMessage') {
      clock += 1;
      const post: StubPost = {
        channel: String(body.channel ?? ''),
        text: String(body.text ?? ''),
        threadTs: typeof body.thread_ts === 'string' ? body.thread_ts : null,
        ts: `${clock}.000100`,
        token,
      };
      posts.push(post);
      return json(response, 200, { ok: true, channel: post.channel, ts: post.ts });
    }
    return json(response, 200, { ok: false, error: 'unknown_method' });
  });

  await new Promise<void>((resolve) => server.listen(port, '127.0.0.1', resolve));
  const address = server.address();
  const bound = typeof address === 'object' && address ? address.port : port;
  return {
    url: `http://127.0.0.1:${bound}`,
    posts,
    close: () => new Promise<void>((resolve) => server.close(() => resolve())),
  };
}

/** Run it on its own, the way the other stubs are run: before the API starts. */
if (process.argv[1]?.endsWith('slack-stub.ts')) {
  startSlackStub(Number(process.env.SLACK_STUB_PORT ?? 4322)).then((stub) => {
    console.log(`slack stub listening on ${stub.url}`);
  });
}
