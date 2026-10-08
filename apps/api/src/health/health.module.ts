import { Module } from '@nestjs/common';
import { HttpMetricsModule } from '@oppenheimer/backend-core';
import { apiHttpMetricsOptions } from './infrastructure/http-metrics.config';
import { RedisHealthIndicator } from './infrastructure/redis-health.adapter';
import { HealthProbeController } from './probes/health.probe.controller';
import { MetricsProbeController } from './probes/metrics.probe.controller';
import { ReadinessIndicator } from './probes/readiness.indicator';

@Module({
  // The request metrics' middleware applies to every route; it lives here
  // because the route policy and the scrape that renders it do.
  imports: [HttpMetricsModule.register(apiHttpMetricsOptions)],
  controllers: [HealthProbeController, MetricsProbeController],
  providers: [RedisHealthIndicator, ReadinessIndicator],
})
export class HealthModule {}
