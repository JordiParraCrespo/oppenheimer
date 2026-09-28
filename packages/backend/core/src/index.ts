export {
  ApiAuthProblemResponses,
  ApiProblemResponse,
  type ApiProblemResponseOptions,
} from './decorators/api-problem-response.decorator';
export { InvalidParamDto, ProblemDetailsDto } from './dtos/problem-details.dto';
export {
  AppError,
  type AppErrorOptions,
  type ErrorDefinition,
} from './errors/app.error';
export {
  buildProblemDetails,
  DEFAULT_ERROR_TYPE_BASE_URL,
  DEFAULT_PROBLEM_TYPE,
  type InvalidParam,
  isProblemDetails,
  PROBLEM_JSON_CONTENT_TYPE,
  type ProblemDetails,
  problemTypeFor,
  titleForStatus,
} from './errors/problem-details';
export { type Maybe, requireFound } from './errors/require-found';
export { AllExceptionsFilter } from './filters/all-exceptions.filter';
export { RequestContextInterceptor } from './interceptors/request-context.interceptor';
export {
  type AuthRouteLoggingMiddleware,
  createAuthRouteLoggingMiddleware,
} from './logging/auth-route-logging.middleware';
export {
  LoggingModule,
  type LoggingModuleAsyncOptions,
} from './logging/logging.module';
export {
  buildPinoHttpOptions,
  type LoggingOptions,
} from './logging/pino-http-options';
export { UserContextInterceptor } from './logging/user-context.interceptor';
export { SanitizePipe } from './pipes/sanitize.pipe';
export { requestMemo } from './requests/request-memo';
export { type PageMeta, toPageMeta } from './responses/page-meta';
export { PaginatedResponseDto } from './responses/paginated-response.dto';
export {
  CapabilitiesService,
  type CapabilityMap,
} from './services/capabilities.service';
