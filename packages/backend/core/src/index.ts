export type { Counter, Gauge, Histogram, Registry } from '@prometheus-io/client';
export { likeContains } from './database/like-contains';
export {
  ApiAuthProblemResponses,
  ApiProblemResponse,
  type ApiProblemResponseOptions,
} from './decorators/api-problem-response.decorator';
export { nullableEnum } from './decorators/nullable-enum';
export { InvalidParamDto, ProblemDetailsDto } from './dtos/problem-details.dto';
export {
  AppError,
  type AppErrorOptions,
  type ErrorDefinition,
} from './errors/app.error';
export { describeError } from './errors/describe-error';
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
export {
  type AuthRouteLoggingMiddleware,
  createAuthRouteLoggingMiddleware,
} from './logging/auth-route-logging.middleware';
export {
  CORRELATION_HEADER,
  resolveCorrelationId,
} from './logging/correlation-id';
export {
  LoggingModule,
  type LoggingModuleAsyncOptions,
} from './logging/logging.module';
export {
  buildPinoHttpOptions,
  type LoggingOptions,
} from './logging/pino-http-options';
export { UserContextInterceptor } from './logging/user-context.interceptor';
export { HTTP_LATENCY_BUCKETS_SECONDS, MILLISECOND_LATENCY_BUCKETS } from './metrics/buckets';
export {
  HTTP_METRICS_MAX_GROUPS,
  HTTP_METRICS_MAX_RULES,
  HTTP_REQUEST_DURATION_SECONDS,
  HTTP_REQUESTS_TOTAL,
  HTTP_STATUS_CLASSES,
  HttpMetrics,
  HttpMetricsMiddleware,
  HttpMetricsModule,
  type HttpMetricsOptions,
  type HttpMetricsRouteRule,
  httpMetricRoute,
} from './metrics/http-metrics.module';
export {
  createMetricsProvider,
  InjectMetric,
  METRICS_REGISTRY,
  type MetricType,
  type ModuleMetric,
  type ModuleMetrics,
  metricToken,
} from './metrics/metric';
export { MetricsModule, type MetricsModuleOptions } from './metrics/metrics.module';
export { RequestContextMiddleware } from './middleware/request-context.middleware';
export { SanitizePipe } from './pipes/sanitize.pipe';
export { requestMemo } from './requests/request-memo';
export { type PageMeta, toPageMeta } from './responses/page-meta';
export { PaginatedResponseDto } from './responses/paginated-response.dto';
export {
  CapabilitiesService,
  type CapabilityMap,
} from './services/capabilities.service';
export {
  ConcurrencyLimit,
  type ConcurrencyLimitOptions,
  ConcurrencyLimitSaturatedError,
} from './upstream/concurrency-limit';
export {
  type RateLimitedResponse,
  type RateLimitSignal,
  type ReadRateLimitOptions,
  readRateLimit,
} from './upstream/rate-limit-signal';
export {
  type ExchangedResponse,
  type RefusalReader,
  UpstreamLimiter,
  type UpstreamLimiterOptions,
} from './upstream/upstream-limiter';
export {
  UpstreamPause,
  type UpstreamPauseOptions,
  type UpstreamPauseStore,
} from './upstream/upstream-pause';
export { upstreamRateLimited } from './upstream/upstream-rate-limited.error';
