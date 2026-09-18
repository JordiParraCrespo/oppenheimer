import { Module } from '@nestjs/common';
import { TerminusModule } from '@nestjs/terminus';
import { RedisHealthIndicator } from './infrastructure/redis-health.adapter';
import { HealthProbeController } from './probes/health.probe.controller';

@Module({
  imports: [TerminusModule],
  controllers: [HealthProbeController],
  providers: [RedisHealthIndicator],
})
export class HealthModule {}
