/** The translate function the product package's word helpers take, so it need not install i18next itself. */
export type { TFunction } from 'i18next';
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
  clock,
  dateFormatter,
  dayOffset,
  viewerTimeZone,
  wallClock,
  weekdayDate,
} from './format-date';
export {
  type EventSourceFactory,
  type EventSourceLike,
  ServerEventStream,
  type ServerEventStreamOptions,
  type ServerEventStreamStatus,
} from './server-event-stream';
export type { IStorageService } from './storage.service';
