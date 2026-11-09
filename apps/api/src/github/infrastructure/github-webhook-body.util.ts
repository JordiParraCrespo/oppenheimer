import { type Type, VersioningType } from '@nestjs/common';
import { PATH_METADATA, VERSION_METADATA } from '@nestjs/common/constants';
import type { ApplicationConfig, HttpAdapterHost } from '@nestjs/core';
import bodyParser from 'body-parser';
import type { Request, RequestHandler } from 'express';

/**
 * GitHub's own cap: "Payloads are capped at 25 MB", and a larger event is
 * never delivered. The app-wide JSON parser's 100 kB default refused ordinary
 * `push` and `pull_request` deliveries.
 */
export const GITHUB_WEBHOOK_BODY_LIMIT_BYTES = 25 * 1024 * 1024;

/**
 * Reads the webhook's body as raw bytes into `req.body`, up to GitHub's cap:
 * the signature is an HMAC over exactly what GitHub sent, and nothing is
 * parsed before it is verified. Any content type, since GitHub also sends
 * `application/x-www-form-urlencoded`; no `Content-Encoding`, since GitHub
 * sends none and the bytes it signed are the ones on the wire. A body over
 * the cap is refused with 413 and never held: past the cap, body-parser
 * discards what is still coming and answers once the client stops sending
 * (Node's `requestTimeout` bounds how long that can be).
 *
 * It is mounted on the HTTP adapter from `configure`, at the route Nest
 * derives for `controller.method`. Nest calls every module's `configure`
 * before it binds any consumer middleware, so this runs ahead of Better
 * Auth's app-wide JSON and form parsers, which then find the body read and
 * leave it alone.
 */
export function mountGithubWebhookBodyParser(
  adapterHost: HttpAdapterHost,
  config: ApplicationConfig,
  controller: Type,
  method: string,
): void {
  const parse = bodyParser.raw({
    type: () => true,
    inflate: false,
    limit: GITHUB_WEBHOOK_BODY_LIMIT_BYTES,
  });
  // Express mounts by prefix; only the route itself (with or without its
  // trailing slash) is read at this limit.
  const exact: RequestHandler = (req, res, next) =>
    (req as Request).path === '/' ? parse(req, res, next) : next();
  adapterHost.httpAdapter.use(routeOf(config, controller, method), exact);
}

/** `/<global prefix>/v<version>/<controller path>/<method path>`, as Nest's URI versioning routes it. */
function routeOf(config: ApplicationConfig, controller: Type, method: string): string {
  const handler = controller.prototype[method];
  const versioning = config.getVersioning();
  const version: unknown = Reflect.getMetadata(VERSION_METADATA, handler);
  const versionSegment =
    versioning?.type === VersioningType.URI && typeof version === 'string'
      ? `${versioning.prefix === false ? '' : (versioning.prefix ?? 'v')}${version}`
      : '';
  const segments = [
    config.getGlobalPrefix(),
    versionSegment,
    Reflect.getMetadata(PATH_METADATA, controller),
    Reflect.getMetadata(PATH_METADATA, handler),
  ];
  return `/${segments
    .map((segment) => String(segment ?? '').replace(/^\/+|\/+$/g, ''))
    .filter(Boolean)
    .join('/')}`;
}
