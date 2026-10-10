import { type DynamicModule, Global, Module } from '@nestjs/common';
import { collectDefaultMetrics, Registry } from '@prometheus-io/client';
import { METRICS_REGISTRY } from './metric';

export interface MetricsModuleOptions {
  /** Labels every series carries, e.g. `{ app: 'api' }`. Static values only. */
  defaultLabels?: Record<string, string>;
  /** The client's process and runtime metrics (heap, event loop lag, GC). On by default. */
  defaultMetrics?: boolean;
}

/**
 * Binds the application's metrics registry, once, globally, so every module's
 * `createMetricsProvider` registers on it and the scrape endpoint renders it.
 *
 * A registry of its own rather than the client's global one: two applications
 * in one process (a test booting several) never see each other's series, and
 * nothing a dependency registers globally leaks into the scrape.
 */
@Global()
@Module({})
export class MetricsModule {
  static forRoot(options: MetricsModuleOptions = {}): DynamicModule {
    return {
      module: MetricsModule,
      providers: [
        {
          provide: METRICS_REGISTRY,
          useFactory: () => {
            const registry = new Registry();
            if (options.defaultLabels) registry.setDefaultLabels(options.defaultLabels);
            if (options.defaultMetrics ?? true) collectDefaultMetrics({ register: registry });
            return registry;
          },
        },
      ],
      exports: [METRICS_REGISTRY],
    };
  }
}
