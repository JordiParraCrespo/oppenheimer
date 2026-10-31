export type { CoreModuleConfig } from './core.module';
export { assignProps } from './entity-props';
export {
  createErrorMessageResolver,
  type ErrorMessageKey,
  type ErrorMessageResolverOptions,
  type ErrorMessageTranslateFn,
  type ResolvedErrorMessage,
} from './error-message';
export {
  type ApiCall,
  AppError,
  type AppErrorOptions,
  callApi,
  type ErrorDefinition,
  type SdkResult,
  unwrapBody,
} from './errors';
export {
  type EventSourceLike,
  ServerEventStream,
  type ServerEventStreamOptions,
  type ServerEventStreamStatus,
} from './server-event-stream';
export type { IStorageService } from './storage.service';
