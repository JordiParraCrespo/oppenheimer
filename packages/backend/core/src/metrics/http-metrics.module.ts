import {
  type DynamicModule,
  Inject,
  Injectable,
  type MiddlewareConsumer,
  Module,
  type NestMiddleware,
  type NestModule,
  type OnModuleInit,
} from '@nestjs/common';
import { HTTP_LATENCY_BUCKETS_SECONDS } from './buckets';
import { createMetricsProvider, InjectMetric, type ModuleMetrics } from './metric';

export const HTTP_REQUESTS_TOTAL = 'http_requests_total';
export const HTTP_REQUEST_DURATION_SECONDS = 'http_request_duration_seconds';

export const HttpMetrics: ModuleMetrics = {
  [HTTP_REQUESTS_TOTAL]: {
    type: 'counter',
    help: 'HTTP responses by bounded route group and status class; aborted connections are their own class',
    labelNames: ['route', 'status_class'],
  },
  [HTTP_REQUEST_DURATION_SECONDS]: {
    type: 'histogram',
    help: 'Time to a completed HTTP response, guards included; excludes probes and aborted connections',
    labelNames: ['route'],
    buckets: HTTP_LATENCY_BUCKETS_SECONDS,
  },
};

/** Every value `status_class` can take, created at zero for every group. */
export const HTTP_STATUS_CLASSES = ['1xx', '2xx', '3xx', '4xx', '5xx', 'aborted', 'other'] as const;

/**
 * How a route template becomes a `route` label. A rule matches a template
 * exactly (`template`) or every template under a path (`templatePrefix`,
 * matched on a segment boundary); `method` narrows either to one verb.
 */
export type HttpMetricsRouteRule = {
  readonly group: string;
  readonly method?: string;
} & ({ readonly template: string } | { readonly templatePrefix: string });

export interface HttpMetricsOptions {
  /** Stripped from a template before matching, e.g. `/api`. */
  readonly prefix: string;
  /** Templates (after the prefix) that are never recorded: probes and the scrape itself. */
  readonly excludedTemplates: readonly string[];
  /** Ordered most specific first; the first match names the group, nothing matching is `other`. */
  readonly routes: readonly HttpMetricsRouteRule[];
}

/** At most this many rules, and this many groups, so the label set stays small by construction. */
export const HTTP_METRICS_MAX_RULES = 100;
export const HTTP_METRICS_MAX_GROUPS = 20;

const GROUP_NAME = /^[a-z][a-z0-9_]{0,39}$/;
const HTTP_METRICS_OPTIONS = Symbol('HTTP_METRICS_OPTIONS');

function matches(rule: HttpMetricsRouteRule, route: string): boolean {
  if ('template' in rule) return rule.template === route;
  return route === rule.templatePrefix || route.startsWith(`${rule.templatePrefix}/`);
}

/**
 * The `route` label of a request, from the template the router matched —
 * never the URL, which carries ids, tokens and anything a caller types.
 *
 * @returns the configured group, `other` for anything unmatched (an unknown
 * path, a route mounted outside the router), or `null` for an excluded one.
 */
export function httpMetricRoute(
  options: HttpMetricsOptions,
  template: unknown,
  method = 'GET',
): string | null {
  if (typeof template !== 'string') return 'other';
  const route =
    options.prefix && template.startsWith(`${options.prefix}/`)
      ? template.slice(options.prefix.length)
      : template;
  if (options.excludedTemplates.includes(route)) return null;
  return (
    options.routes.find((rule) => matches(rule, route) && (!rule.method || rule.method === method))
      ?.group ?? 'other'
  );
}

interface CounterLike {
  inc(labels: Record<string, string>, value?: number): void;
}

interface HistogramLike {
  observe(labels: Record<string, string>, value: number): void;
  zero(labels: Record<string, string>): void;
}

interface RoutedRequest {
  method: string;
  route?: { path?: unknown };
}

interface ObservableResponse {
  statusCode: number;
  writableFinished: boolean;
  once(event: 'finish' | 'close', listener: () => void): unknown;
}

@Injectable()
export class HttpMetricsMiddleware implements NestMiddleware, OnModuleInit {
  constructor(
    @InjectMetric(HTTP_REQUESTS_TOTAL) private readonly requests: CounterLike,
    @InjectMetric(HTTP_REQUEST_DURATION_SECONDS) private readonly duration: HistogramLike,
    @Inject(HTTP_METRICS_OPTIONS) private readonly options: HttpMetricsOptions,
  ) {}

  /**
   * Creates every series at zero, so "no failures yet" is a 0 a rate can be
   * taken over rather than an absent series an alert cannot see; the
   * histogram gets empty buckets, not an invented observation.
   */
  onModuleInit(): void {
    const groups = new Set([...this.options.routes.map((rule) => rule.group), 'other']);
    for (const route of groups) {
      for (const status_class of HTTP_STATUS_CLASSES) this.requests.inc({ route, status_class }, 0);
      this.duration.zero({ route });
    }
  }

  /**
   * Records the final answer exactly once: on `finish` for a response that was
   * written (a guard's 401 included), on `close` for a connection the client
   * dropped first, which is counted as `aborted` and never timed — its
   * duration measures the client's patience, not the server.
   */
  use(request: RoutedRequest, response: ObservableResponse, next: () => void): void {
    const start = performance.now();
    let recorded = false;
    const record = (aborted: boolean): void => {
      if (recorded) return;
      recorded = true;
      // Read now, not at entry: the router sets `request.route` after the
      // middleware chain has run.
      const route = httpMetricRoute(this.options, request.route?.path, request.method);
      if (route === null) return;
      this.requests.inc({ route, status_class: aborted ? 'aborted' : statusClass(response) });
      if (!aborted) this.duration.observe({ route }, (performance.now() - start) / 1_000);
    };
    response.once('finish', () => record(false));
    response.once('close', () => record(!response.writableFinished));
    next();
  }
}

function statusClass(response: ObservableResponse): string {
  const status = Math.floor(response.statusCode / 100);
  return status >= 1 && status <= 5 ? `${status}xx` : 'other';
}

/**
 * HTTP request metrics, labelled by a route policy the application owns.
 * Needs `MetricsModule.forRoot()` for the registry it records on.
 */
@Module({})
export class HttpMetricsModule implements NestModule {
  /**
   * @throws when the policy could produce an unbounded or unsafe label set:
   * more than {@link HTTP_METRICS_MAX_RULES} rules, more than
   * {@link HTTP_METRICS_MAX_GROUPS} groups, or a group that is not a static
   * identifier. Failing at boot is the point: cardinality is decided here,
   * not discovered in Prometheus.
   */
  static register(options: HttpMetricsOptions): DynamicModule {
    if (
      options.routes.length > HTTP_METRICS_MAX_RULES ||
      new Set(options.routes.map((rule) => rule.group)).size > HTTP_METRICS_MAX_GROUPS
    ) {
      throw new Error('HTTP metrics route policy exceeds its cardinality budget');
    }
    if (options.routes.some((rule) => !GROUP_NAME.test(rule.group))) {
      throw new Error('HTTP metrics groups must be static identifiers');
    }
    const policy: HttpMetricsOptions = Object.freeze({
      prefix: options.prefix,
      excludedTemplates: Object.freeze([...options.excludedTemplates]),
      routes: Object.freeze(options.routes.map((rule) => Object.freeze({ ...rule }))),
    });
    return {
      module: HttpMetricsModule,
      providers: [
        ...createMetricsProvider(HttpMetrics),
        { provide: HTTP_METRICS_OPTIONS, useValue: policy },
        HttpMetricsMiddleware,
      ],
    };
  }

  /** Ahead of the guards, so a request they refuse is still counted. */
  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(HttpMetricsMiddleware).forRoutes('*');
  }
}
