import { Injectable, type NestMiddleware } from '@nestjs/common';
import { RequestContextService } from '@oppenheimer/backend-ddd';
import { CORRELATION_HEADER, resolveCorrelationId } from '../logging/correlation-id';

interface CorrelatedRequest {
  headers: Record<string, unknown>;
  id?: unknown;
}

interface HeaderWritableResponse {
  setHeader(name: string, value: string): unknown;
}

/**
 * Opens the per-request `RequestContextService` scope: the correlation id that
 * commands, domain events, outbox rows and problem documents carry.
 *
 * It is middleware, not an interceptor, because Nest runs guards before
 * interceptors: a context opened in an interceptor does not exist yet when the
 * throttler, auth, policy or scope guards reject a request, and those
 * 401/403/429 answers are the ones people report.
 *
 * The id is the one pino-http logs as `req.id` (whichever of the two runs first
 * sets it and the other reuses it), echoed as `x-correlation-id` on the
 * response. Apply it to every route: `consumer.apply(...).forRoutes('*')`.
 */
@Injectable()
export class RequestContextMiddleware implements NestMiddleware {
  use(req: CorrelatedRequest, res: HeaderWritableResponse, next: (error?: unknown) => void) {
    const correlationId = resolveCorrelationId(req);
    req.id = correlationId;
    res.setHeader(CORRELATION_HEADER, correlationId);
    RequestContextService.run({ correlationId }, () => next());
  }
}
