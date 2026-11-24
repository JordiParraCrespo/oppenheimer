import type { IncomingMessage, ServerResponse } from 'node:http';
import type { Options } from 'pino-http';
import { CORRELATION_HEADER, resolveCorrelationId } from './correlation-id';

export interface LoggingOptions {
  /** Render through `pino-pretty` instead of emitting JSON (development only). */
  pretty?: boolean;
  /**
   * Minimum level to emit (pino's default is `info`). Raise to `debug` when a
   * debug-level opt-in (like SQL query logging) must actually reach the sink.
   */
  level?: string;
  /**
   * An absolute path to also write every line to, as JSON whatever `pretty`
   * says: what a log shipper (Grafana Alloy, into Loki) tails. Its directory
   * is created when missing; the file is appended to, never rotated here.
   */
  file?: string;
  /**
   * Paths whose successful requests are not logged: the probes a container
   * runtime or a load balancer calls every few seconds. A failing one (a
   * status of 400 or above) is still logged.
   */
  quietPaths?: readonly string[];
}

/**
 * Where lines go: stdout (pretty or JSON) and, with `file`, that file as JSON
 * too. Undefined is pino's default, JSON on stdout, in this thread.
 */
function transportOf(options: LoggingOptions): Options['transport'] {
  if (!options.file) return options.pretty ? { target: 'pino-pretty' } : undefined;
  const level = options.level ?? 'info';
  return {
    targets: [
      options.pretty
        ? { target: 'pino-pretty', level, options: {} }
        : { target: 'pino/file', level, options: { destination: 1 } },
      { target: 'pino/file', level, options: { destination: options.file, mkdir: true } },
    ],
  };
}

/**
 * Headers that carry credentials. The serializers below drop headers entirely,
 * but the redaction stays as a backstop so a future serializer change (or a
 * log call passing a raw request) can never leak a session cookie or bearer
 * token into the log sink.
 */
const REDACT_PATHS = [
  'req.headers.cookie',
  'req.headers.authorization',
  'req.headers["set-cookie"]',
  'res.headers["set-cookie"]',
];

const ERROR_CODE = Symbol('oppenheimer.errorCode');

/**
 * Records the problem code a response answers with (`SESS_014`), for its
 * request log line. The exception filter calls it; without it a 404 for a
 * route that does not exist and one for a row that does not exist read alike.
 */
export function recordErrorCode(res: object, code: string | undefined): void {
  if (code) (res as { [ERROR_CODE]?: string })[ERROR_CODE] = code;
}

function errorCodeOf(res: object): string | undefined {
  return (res as { [ERROR_CODE]?: string })[ERROR_CODE];
}

/**
 * The level of a request's line, by its outcome: a server failure is an
 * error, a refused request a warning, the rest info. A quiet path's success
 * is not logged at all.
 */
function levelOf(
  res: { statusCode: number },
  err: Error | undefined,
  path: string | undefined,
  quietPaths: ReadonlySet<string>,
): 'error' | 'warn' | 'info' | 'silent' {
  if (err || res.statusCode >= 500) return 'error';
  if (res.statusCode >= 400) return 'warn';
  if (path !== undefined && quietPaths.has(path)) return 'silent';
  return 'info';
}

/**
 * One key for a line's message. Nest's loggers pass an object whose text is
 * `message` (`logger.log({ message, hostId })`), which pino writes as is,
 * beside lines whose text is pino's `msg`; a query over one key missed the
 * other half. An object with a string `message` and no separate text has it
 * moved to `msg`.
 */
function messageAsMsg(this: unknown, args: unknown[], method: (...args: unknown[]) => void) {
  const [first] = args;
  if (
    args.length === 1 &&
    first !== null &&
    typeof first === 'object' &&
    !(first instanceof Error) &&
    typeof (first as { message?: unknown }).message === 'string'
  ) {
    const { message, ...rest } = first as { message: string };
    return method.apply(this, [rest, message]);
  }
  return method.apply(this, args);
}

/** Query strings routinely carry tokens (password reset, OAuth callbacks). */
function stripQuery(url: string): string {
  const queryStart = url.indexOf('?');
  return queryStart === -1 ? url : url.slice(0, queryStart);
}

/**
 * Hardened `pino-http` options shared by the request logger and the Better
 * Auth route logger: headers, query strings, and request bodies routinely
 * carry session cookies and personal data, so a request log line contains
 * only the fields known to be safe.
 */
export function buildPinoHttpOptions(options: LoggingOptions = {}): Options {
  const quietPaths = new Set(options.quietPaths ?? []);
  return {
    // The request id is the correlation id: a valid client-sent
    // `x-correlation-id` or a fresh UUID (never pino's default counter), echoed
    // on the response so the log line, the header and the problem document
    // all carry the same value. `RequestContextMiddleware` reuses it.
    genReqId(req: IncomingMessage, res: ServerResponse) {
      const id = resolveCorrelationId(req as IncomingMessage & { id?: unknown });
      res.setHeader(CORRELATION_HEADER, id);
      return id;
    },
    customLogLevel: (req, res, err) =>
      levelOf(res, err, req.url === undefined ? undefined : stripQuery(req.url), quietPaths),
    // Read when the line is written, so the code the exception filter
    // recorded is there; at the request's start there is none yet.
    customProps: (_req, res) => {
      const errorCode = errorCodeOf(res);
      return errorCode ? { errorCode } : {};
    },
    hooks: { logMethod: messageAsMsg },
    redact: { paths: REDACT_PATHS, remove: true },
    serializers: {
      // pino-http wraps these, so `req`/`res` arrive already serialized by the
      // std serializers; returning a subset is what drops the rest.
      req(req: { id?: unknown; method?: string; url?: string; remoteAddress?: string }) {
        return {
          id: req.id,
          method: req.method,
          url: req.url === undefined ? undefined : stripQuery(req.url),
          remoteAddress: req.remoteAddress,
        };
      },
      res(res: { statusCode?: number }) {
        return { statusCode: res.statusCode };
      },
    },
    transport: transportOf(options),
    ...(options.level ? { level: options.level } : {}),
  };
}
