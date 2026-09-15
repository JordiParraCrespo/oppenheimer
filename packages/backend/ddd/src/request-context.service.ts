import { AsyncLocalStorage } from 'node:async_hooks';

interface RequestContext {
  correlationId: string;
}

/**
 * Process-wide request context backed by AsyncLocalStorage. Used to propagate a
 * correlation id into domain events and commands without threading it through
 * every call. Framework-agnostic: the HTTP layer (see
 * `@oppenheimer/backend-core`'s `RequestContextInterceptor`) seeds it per request.
 */
export class RequestContextService {
  private static storage = new AsyncLocalStorage<RequestContext>();

  static run(context: RequestContext, fn: () => void) {
    RequestContextService.storage.run(context, fn);
  }

  static getCorrelationId(): string | undefined {
    return RequestContextService.storage.getStore()?.correlationId;
  }

  static setCorrelationId(id: string) {
    const store = RequestContextService.storage.getStore();
    if (store) {
      store.correlationId = id;
    }
  }
}
