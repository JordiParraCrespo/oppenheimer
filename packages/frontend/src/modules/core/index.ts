export { type CoreModuleConfig, createCoreModule } from './core.module';
export {
  createErrorMessageResolver,
  type ErrorMessageKey,
  type ErrorMessageResolverOptions,
  type ErrorMessageTranslateFn,
  type ResolvedErrorMessage,
} from './error-message';
export {
  AppError,
  type AppErrorOptions,
  type ErrorDefinition,
  toAppError,
} from './errors';
export { MapApiError } from './map-api-error.decorator';
export type { IStorageService } from './storage.service';
