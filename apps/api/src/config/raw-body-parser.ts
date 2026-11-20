import { PayloadTooLargeException, type Type, VersioningType } from '@nestjs/common';
import { PATH_METADATA, VERSION_METADATA } from '@nestjs/common/constants';
import type { ApplicationConfig, HttpAdapterHost } from '@nestjs/core';
import bodyParser from 'body-parser';
import type { Request, RequestHandler } from 'express';

/**
 * Reads one route's body as raw bytes into `req.body`, up to `limit`: for a
 * webhook whose signature is an HMAC over exactly what was sent, so nothing
 * is parsed before it is verified. Any content type; no `Content-Encoding`,
 * since the bytes signed are the ones on the wire. A body over the limit is
 * refused with 413 and never held: past it, body-parser discards what is
 * still coming and hands the route on once the client stops sending (Node's
 * `requestTimeout` bounds how long that can be).
 *
 * Mount it from the owning module's `configure`, at the route Nest derives
 * for `controller.method`. Nest calls every module's `configure` before it
 * binds any consumer middleware, so this runs ahead of Better Auth's
 * app-wide JSON and form parsers, which then find the body read and leave it
 * alone.
 */
export function mountRawBodyParser(
  adapterHost: HttpAdapterHost,
  config: ApplicationConfig,
  controller: Type,
  method: string,
  limit: number,
): void {
  const parse = bodyParser.raw({ type: () => true, inflate: false, limit });
  // A body over the limit reaches the route marked rather than as Express's
  // HTML 413, so it is answered as a problem document like any other refusal:
  // by the route (`isBodyTooLarge`), or by `rawBodyOf`.
  const read: RequestHandler = (req, res, next) =>
    parse(req, res, (error?: unknown) => {
      if ((error as { type?: string } | undefined)?.type !== 'entity.too.large') {
        return next(error);
      }
      (req as Request & { [TOO_LARGE]?: true })[TOO_LARGE] = true;
      next();
    });
  // Express mounts by prefix; only the route itself (with or without its
  // trailing slash) is read at this limit.
  const exact: RequestHandler = (req, res, next) =>
    (req as Request).path === '/' ? read(req, res, next) : next();
  adapterHost.httpAdapter.use(routeOf(config, controller, method), exact);
}

const TOO_LARGE = Symbol('raw body over the limit');

/** Whether the raw parser refused this request's body as over its limit. */
export function isBodyTooLarge(request: Request): boolean {
  return (request as Request & { [TOO_LARGE]?: true })[TOO_LARGE] === true;
}

/**
 * The bytes the raw parser read; a body it refused as too large is a 413. No
 * body at all (a bare POST) is an empty payload; anything else is a pipeline that parsed the route as something
 * other than raw bytes, and a digest over that would never match what was
 * signed.
 */
export function rawBodyOf(request: Request): Buffer {
  if (isBodyTooLarge(request)) throw new PayloadTooLargeException();
  if (Buffer.isBuffer(request.body)) return request.body;
  if (request.body === undefined) return Buffer.alloc(0);
  throw new Error('A webhook body was parsed before the raw parser read it');
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
