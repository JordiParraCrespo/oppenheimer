#!/usr/bin/env node
import '@oppenheimer/env/load';
import { toNodeHandler } from '@modelcontextprotocol/node';
import { type AuthInfo, createMcpHandler } from '@modelcontextprotocol/server';
import express, { type NextFunction, type Request, type Response } from 'express';
import { type CurrentCredential, OppenheimerApiError, OppenheimerClient } from '../client';
import { loadConfig, type McpConfig } from '../config';
import { createServer } from '../server';

/**
 * Remote entrypoint: a Streamable HTTP MCP server.
 *
 * `2026-07-28` made the protocol itself stateless — no `initialize` handshake,
 * no `Mcp-Session-Id`, nothing retained between requests — which is the model
 * this server already wanted. Each request carries its own credential (an OAuth
 * 2.1 access token obtained through the consent screen, or a scoped API token),
 * and `createMcpHandler` builds a server from that credential's effective
 * scopes for that request alone. One deployment therefore serves every user at
 * their own permission level, behind a plain round-robin load balancer, with no
 * shared state to keep in sync.
 *
 * Clients still speaking the 2025 revision are served by the handler's legacy
 * fallback from the same factory, so upgrading the server does not strand them.
 */
async function main(): Promise<void> {
  const config = loadConfig();
  const app = express();

  const onerror = (error: Error) => console.error(`[oppenheimer-mcp] ${error.message}`);

  // One handler for the process; it builds a fresh server per request from the
  // credential that request authenticated with.
  const handler = createMcpHandler(
    (ctx) => {
      const credential = credentialOf(ctx.authInfo);
      const token = ctx.authInfo?.token;
      if (!credential || !token) {
        // Unreachable: `authenticate` refuses the request before it gets here.
        throw new Error('Request reached the MCP handler without a verified credential.');
      }

      const client = new OppenheimerClient({
        apiUrl: config.apiUrl,
        token,
        timeoutMs: config.timeoutMs,
      });

      return createServer({
        client,
        scopes: credential.effectiveScopes,
        toolsCacheTtlMs: config.toolsCacheTtlMs,
      }).server;
    },
    { onerror },
  );

  const serveMcp = toNodeHandler(handler, { onerror });

  app.use(express.json({ limit: '1mb' }));
  app.use(originGuard(config));

  app.get('/health', (_req, res) => {
    res.json({ status: 'ok', api: config.apiUrl });
  });

  app.all('/mcp', authenticate(config), (req, res) => {
    // `req.body` is passed explicitly: `express.json()` already drained the
    // stream, so the adapter must not try to read it again.
    void serveMcp(req, res, req.body);
  });

  app.listen(config.port, () => {
    console.error(`[oppenheimer-mcp] listening on :${config.port}, proxying ${config.apiUrl}`);
  });
}

/** The credential the API resolved for this token, stashed by `authenticate`. */
function credentialOf(authInfo: AuthInfo | undefined): CurrentCredential | undefined {
  return authInfo?.extra?.credential as CurrentCredential | undefined;
}

/**
 * Verifies the request's bearer token against the API and attaches the result
 * as `req.auth`, which the MCP adapter forwards to the handler factory.
 *
 * Verification is a call to `/me/credential` rather than local token parsing:
 * it is the API that decides what a credential currently reaches, so asking it
 * is what makes a revoked role take effect on the very next request.
 */
function authenticate(config: McpConfig) {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const token = bearerToken(req);

    if (!token) {
      unauthorized(res, config, 'A bearer token is required.');
      return;
    }

    const client = new OppenheimerClient({
      apiUrl: config.apiUrl,
      token,
      timeoutMs: config.timeoutMs,
    });

    let credential: CurrentCredential;
    try {
      credential = await client.currentCredential();
    } catch (error) {
      if (error instanceof OppenheimerApiError && error.isPermissionError) {
        unauthorized(res, config, error.message);
        return;
      }
      res.status(502).json({
        error: 'upstream_unavailable',
        message: error instanceof Error ? error.message : String(error),
      });
      return;
    }

    const auth: AuthInfo = {
      token,
      clientId: credential.userId,
      scopes: credential.effectiveScopes,
      // Only set when the credential actually expires: an API token minted
      // without an expiry has none, and inventing one would make it look
      // revocable at a time nothing enforces.
      ...(credential.expiresAt
        ? {
            expiresAt: Math.floor(new Date(credential.expiresAt).getTime() / 1000),
          }
        : {}),
      extra: { credential },
    };

    (req as Request & { auth?: AuthInfo }).auth = auth;
    next();
  };
}

/** `Authorization: Bearer <token>`, or null. */
function bearerToken(req: Request): string | null {
  const header = req.headers.authorization;
  if (!header) return null;

  const [scheme, ...rest] = header.split(' ');
  if (scheme.toLowerCase() !== 'bearer') return null;

  return rest.join(' ').trim() || null;
}

/**
 * A 401 that points the client at the OAuth server, as the MCP authorization
 * spec requires — this is what lets a client discover where to send the user
 * for consent instead of just failing.
 */
function unauthorized(res: Response, config: McpConfig, message: string): void {
  const metadata = `${config.apiUrl.replace(/\/+$/, '')}/api/auth/.well-known/oauth-protected-resource`;
  res
    .status(401)
    .set('WWW-Authenticate', `Bearer resource_metadata="${metadata}"`)
    .json({ error: 'unauthorized', message });
}

/**
 * Rejects browser requests from origins that were not explicitly allowed.
 * Without an `Origin` header the request is not browser-initiated (a native MCP
 * client), so it passes; this is the DNS-rebinding protection the MCP spec
 * calls for on locally reachable servers.
 */
function originGuard(config: McpConfig) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const origin = req.headers.origin;
    if (!origin) {
      next();
      return;
    }

    if (config.allowedOrigins.includes(origin)) {
      res.set('Access-Control-Allow-Origin', origin);
      // `Mcp-Method` / `Mcp-Name` are required on every `2026-07-28` POST so
      // gateways can route and meter without parsing the body; a browser client
      // cannot send them unless they are allowed here. `Mcp-Session-Id` is gone
      // along with the sessions it identified.
      res.set(
        'Access-Control-Allow-Headers',
        'authorization, content-type, mcp-method, mcp-name, mcp-protocol-version',
      );
      if (req.method === 'OPTIONS') {
        res.sendStatus(204);
        return;
      }
      next();
      return;
    }

    res.status(403).json({
      error: 'origin_not_allowed',
      message: `Origin ${origin} is not allowed. Set OPPENHEIMER_ALLOWED_ORIGINS to permit it.`,
    });
  };
}

main().catch((error: unknown) => {
  console.error(`[oppenheimer-mcp] ${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
});
