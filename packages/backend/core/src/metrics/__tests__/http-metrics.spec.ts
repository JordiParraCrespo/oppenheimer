/**
 * The request-metrics middleware and the metric providers, on fakes and on a
 * real registry: series exist at zero, each response is recorded once, an
 * aborted connection is not a success, and the label set cannot grow past
 * its budget. Routing through a real Nest app is the API's
 * `http-metrics-routing.spec.ts`.
 */
import { EventEmitter } from 'node:events';
import { Registry } from '@prometheus-io/client';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  HttpMetrics,
  HttpMetricsMiddleware,
  HttpMetricsModule,
  type HttpMetricsOptions,
  httpMetricRoute,
} from '../http-metrics.module';
import { createMetricsProvider, METRICS_REGISTRY, metricToken } from '../metric';

const options: HttpMetricsOptions = {
  prefix: '/api',
  excludedTemplates: ['/v1/metrics', '/v1/health', '/v1/ready'],
  routes: [
    { template: '/v1/sessions', method: 'POST', group: 'session_create' },
    { templatePrefix: '/v1/sessions', group: 'sessions' },
    { templatePrefix: '/v1/hosts', group: 'hosts' },
  ],
};

function response(statusCode: number, writableFinished: boolean) {
  return Object.assign(new EventEmitter(), { statusCode, writableFinished });
}

describe('HTTP metrics', () => {
  const counter = { inc: vi.fn() };
  const histogram = { observe: vi.fn(), zero: vi.fn() };
  const middleware = new HttpMetricsMiddleware(counter, histogram, options);
  beforeEach(() => vi.clearAllMocks());

  it('creates every group and status class at zero without inventing a latency', () => {
    middleware.onModuleInit();

    // three groups plus `other`, seven classes each
    expect(counter.inc).toHaveBeenCalledTimes(28);
    expect(histogram.zero).toHaveBeenCalledTimes(4);
    expect(histogram.observe).not.toHaveBeenCalled();
    expect(counter.inc).toHaveBeenCalledWith({ route: 'hosts', status_class: '5xx' }, 0);
    expect(counter.inc).toHaveBeenCalledWith({ route: 'other', status_class: 'aborted' }, 0);
  });

  it('counts a guard refusal once when close follows finish', () => {
    const res = response(403, true);
    const next = vi.fn();
    middleware.use({ method: 'GET', route: { path: '/api/v1/hosts/:hostId' } }, res as never, next);
    res.emit('finish');
    res.emit('close');

    expect(next).toHaveBeenCalledTimes(1);
    expect(counter.inc).toHaveBeenCalledTimes(1);
    expect(counter.inc).toHaveBeenCalledWith({ route: 'hosts', status_class: '4xx' });
    expect(histogram.observe).toHaveBeenCalledWith({ route: 'hosts' }, expect.any(Number));
  });

  it('labels a dropped connection aborted, never a success, and does not time it', () => {
    const res = response(200, false);
    middleware.use({ method: 'GET' }, res as never, vi.fn());
    res.emit('close');

    expect(counter.inc).toHaveBeenCalledWith({ route: 'other', status_class: 'aborted' });
    expect(histogram.observe).not.toHaveBeenCalled();
  });

  it.each(['/api/v1/metrics', '/api/v1/health', '/api/v1/ready'])(
    'leaves the probe %s out of the request metrics',
    (path) => {
      const res = response(200, true);
      middleware.use({ method: 'GET', route: { path } }, res as never, vi.fn());
      res.emit('finish');
      expect(counter.inc).not.toHaveBeenCalled();
    },
  );

  it('folds every unmatched or malformed template into one label', () => {
    for (let index = 0; index < 1_000; index++) {
      expect(httpMetricRoute(options, `/api/v1/anything/${index}`)).toBe('other');
    }
    expect(httpMetricRoute(options, undefined)).toBe('other');
    expect(httpMetricRoute(options, ['/api/v1/hosts'])).toBe('other');
    // a prefix rule matches on a segment boundary, not a string prefix
    expect(httpMetricRoute(options, '/api/v1/hostsfoo')).toBe('other');
    expect(httpMetricRoute(options, '/api/v1/hosts')).toBe('hosts');
    expect(httpMetricRoute(options, '/api/v1/sessions/:sessionId/stop', 'POST')).toBe('sessions');
  });

  it('lets a method-specific rule take precedence over the prefix behind it', () => {
    expect(httpMetricRoute(options, '/api/v1/sessions', 'POST')).toBe('session_create');
    expect(httpMetricRoute(options, '/api/v1/sessions', 'GET')).toBe('sessions');
  });

  it('refuses a policy whose labels could grow without bound', () => {
    const rule = { template: '/v1/x', group: 'x' };
    const register = (routes: HttpMetricsOptions['routes']) =>
      HttpMetricsModule.register({ ...options, routes });

    expect(() => register([{ template: '/', group: 'user@example.test' }])).toThrow(/static/);
    expect(() => register(Array.from({ length: 101 }, () => rule))).toThrow(/budget/);
    expect(() =>
      register(Array.from({ length: 21 }, (_, i) => ({ template: `/${i}`, group: `g${i}` }))),
    ).toThrow(/budget/);
    expect(() => register(options.routes)).not.toThrow();
  });
});

describe('createMetricsProvider', () => {
  function build(registry: Registry) {
    return createMetricsProvider(HttpMetrics).map((provider) => {
      const { provide, inject, useFactory } = provider as {
        provide: symbol;
        inject: unknown[];
        useFactory: (registry: Registry) => unknown;
      };
      expect(inject).toEqual([METRICS_REGISTRY]);
      return [provide, useFactory(registry)] as const;
    });
  }

  it('registers each metric on the application registry under its own token', async () => {
    const registry = new Registry();
    const built = new Map(build(registry));

    expect([...built.keys()]).toEqual([
      metricToken('http_requests_total'),
      metricToken('http_request_duration_seconds'),
    ]);
    const exposition = await registry.metrics();
    expect(exposition).toContain('# TYPE http_requests_total counter');
    expect(exposition).toContain('# TYPE http_request_duration_seconds histogram');
  });

  it('fails loudly when two modules declare the same metric', () => {
    const registry = new Registry();
    build(registry);
    expect(() => build(registry)).toThrow();
  });

  it('renders a request through real metrics without its path or query', async () => {
    const registry = new Registry();
    const built = new Map(build(registry));
    const real = new HttpMetricsMiddleware(
      built.get(metricToken('http_requests_total')) as never,
      built.get(metricToken('http_request_duration_seconds')) as never,
      options,
    );
    real.onModuleInit();
    const res = response(201, true);
    real.use({ method: 'POST', route: { path: '/api/v1/sessions' } }, res as never, () => {});
    res.emit('finish');

    const exposition = await registry.metrics();
    expect(exposition).toContain(
      'http_requests_total{route="session_create",status_class="2xx"} 1',
    );
    expect(exposition).toContain('http_requests_total{route="hosts",status_class="5xx"} 0');
    expect(exposition).toContain('http_request_duration_seconds_count{route="session_create"} 1');
  });
});
