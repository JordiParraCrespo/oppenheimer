import { type Type, VersioningType } from '@nestjs/common';
import { PATH_METADATA, VERSION_METADATA } from '@nestjs/common/constants';
import type { ApplicationConfig, HttpAdapterHost } from '@nestjs/core';
import bodyParser from 'body-parser';
import type { Request, RequestHandler } from 'express';

/** Slack's event payloads are a few kilobytes; a megabyte is past anything it sends. */
export const SLACK_EVENTS_BODY_LIMIT_BYTES = 1024 * 1024;

/**
 * Reads the events route's body as raw bytes into `req.body`: the signature
 * is an HMAC over exactly what Slack sent, so nothing is parsed before it is
 * checked. Mounted from the module's `configure`, ahead of the app-wide
 * parsers, as `mountGithubWebhookBodyParser` is for GitHub's.
 */
export function mountSlackEventsBodyParser(
  adapterHost: HttpAdapterHost,
  config: ApplicationConfig,
  controller: Type,
  method: string,
): void {
  const parse = bodyParser.raw({
    type: () => true,
    inflate: false,
    limit: SLACK_EVENTS_BODY_LIMIT_BYTES,
  });
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
