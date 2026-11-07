import { Module } from '@nestjs/common';
import { CqrsModule } from '@nestjs/cqrs';
import { HttpMetricsModule } from '@oppenheimer/backend-core';
import { apiHttpMetricsOptions } from './infrastructure/http-metrics.config';
import { RedisHealthIndicator } from './infrastructure/redis-health.adapter';
import { HealthProbeController } from './probes/health.probe.controller';
import { MetricsProbeController } from './probes/metrics.probe.controller';
import { ReadinessIndicator } from './probes/readiness.indicator';
import { FindApiVersionHttpController } from './queries/find-api-version/find-api-version.http.controller';
import { FindApiVersionQueryHandler } from './queries/find-api-version/find-api-version.query-handler';

@Module({
  // The request metrics' middleware applies to every route; it lives here
  // because the route policy and the scrape that renders it do.
  imports: [CqrsModule, HttpMetricsModule.register(apiHttpMetricsOptions)],
  controllers: [HealthProbeController, MetricsProbeController, FindApiVersionHttpController],
  providers: [RedisHealthIndicator, ReadinessIndicator, FindApiVersionQueryHandler],
})
export class HealthModule {}
