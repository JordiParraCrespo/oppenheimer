import { Inject, type Provider } from '@nestjs/common';
import { Counter, Gauge, Histogram, type Registry } from '@prometheus-io/client';

/** The registry every metric of one application is registered on. */
export const METRICS_REGISTRY = Symbol('METRICS_REGISTRY');

export type MetricType = 'counter' | 'gauge' | 'histogram';

export interface ModuleMetric {
  type: MetricType;
  help: string;
  /**
   * Label names the metric is partitioned by. Keep these to closed sets (queue
   * names, route groups, outcomes): an unbounded label such as a request or
   * user id creates a new time series per value and eventually takes
   * Prometheus down.
   */
  labelNames?: readonly string[];
  /**
   * Histogram bucket upper bounds, in the metric's own unit. Supply them for
   * any histogram that does not measure seconds: the client's default buckets
   * stop at 10, so a millisecond observation of 500 falls only into `+Inf` and
   * every quantile saturates at the last finite bound.
   */
  buckets?: readonly number[];
}

/** Metrics a module declares, keyed by metric name. */
export type ModuleMetrics = Record<string, ModuleMetric>;

const tokens = new Map<string, symbol>();

/** The injection token of the metric registered under `name`. */
export function metricToken(name: string): symbol {
  let token = tokens.get(name);
  if (!token) {
    token = Symbol(`metric:${name}`);
    tokens.set(name, token);
  }
  return token;
}

/** Injects the metric `createMetricsProvider` registered under `name`. */
export const InjectMetric = (name: string): ParameterDecorator & PropertyDecorator =>
  Inject(metricToken(name));

/**
 * One provider per metric, each built on the application's
 * {@link METRICS_REGISTRY} (bound by `MetricsModule.forRoot`) and injectable
 * with {@link InjectMetric}. Declaring the same name twice fails at boot: the
 * registry refuses a second metric with a name it already holds.
 */
export function createMetricsProvider(metrics: ModuleMetrics): Provider[] {
  return Object.entries(metrics).map(
    ([name, metric]): Provider => ({
      provide: metricToken(name),
      inject: [METRICS_REGISTRY],
      useFactory: (registry: Registry) => buildMetric(name, metric, registry),
    }),
  );
}

function buildMetric(name: string, metric: ModuleMetric, registry: Registry) {
  const options = {
    name,
    help: metric.help,
    registers: [registry],
    ...(metric.labelNames ? { labelNames: [...metric.labelNames] } : {}),
  };
  switch (metric.type) {
    case 'counter':
      return new Counter(options);
    case 'gauge':
      return new Gauge(options);
    case 'histogram':
      return new Histogram({
        ...options,
        ...(metric.buckets ? { buckets: [...metric.buckets] } : {}),
      });
    default:
      throw new Error(`Unknown metric type for ${name}`);
  }
}
