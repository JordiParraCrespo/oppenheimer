export type { CoreModuleConfig } from './core.module';
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
  unwrap,
  unwrapBody,
} from './errors';
export type { IStorageService } from './storage.service';
