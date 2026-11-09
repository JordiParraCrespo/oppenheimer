import type { IncomingMessage } from 'node:http';
import bodyParser from 'body-parser';
import type { Request, RequestHandler } from 'express';

/**
 * GitHub's own cap: "Payloads are capped at 25 MB", and a larger event is
 * never delivered. The app-wide JSON parser's 100 kB default refused ordinary
 * `push` and `pull_request` deliveries.
 */
export const GITHUB_WEBHOOK_BODY_LIMIT_BYTES = 25 * 1024 * 1024;

/** `HandleGithubWebhookHttpController`'s route under the `api` prefix and URI version 1. */
const GITHUB_WEBHOOK_PATH = '/api/v1/github/webhook';

/** Express routes case-insensitively and with an optional trailing slash, so this matches the same way. */
function isGithubWebhookRequest(req: IncomingMessage): boolean {
  const url = (req as Partial<Request>).originalUrl ?? req.url ?? '';
  const path = url.split('?', 1)[0].toLowerCase().replace(/\/+$/, '');
  return path === GITHUB_WEBHOOK_PATH;
}

const unlessGithubWebhook =
  (mime: string) =>
  (req: IncomingMessage): boolean =>
    !isGithubWebhookRequest(req) && Boolean((req as Request).is(mime));

/**
 * Better Auth's app-wide JSON and form parsers, told to leave the webhook to
 * `githubWebhookBodyParser`. Whichever middleware Nest runs first, the webhook
 * is read once, by its own parser, at its own limit.
 */
export const APP_BODY_PARSER_OPTIONS = {
  json: { type: unlessGithubWebhook('application/json') },
  urlencoded: { type: unlessGithubWebhook('application/x-www-form-urlencoded') },
};

/**
 * Reads the webhook as raw bytes into `req.body`: the signature is an HMAC over
 * exactly what GitHub sent, and nothing is parsed before it is verified. Any
 * content type, since GitHub also sends `application/x-www-form-urlencoded`. A
 * body over the cap is refused with 413, from `Content-Length` before any byte
 * is read or once a chunked body crosses it.
 */
export function githubWebhookBodyParser(): RequestHandler {
  return bodyParser.raw({ type: () => true, limit: GITHUB_WEBHOOK_BODY_LIMIT_BYTES });
}
