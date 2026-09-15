import { Controller, Get } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import {
  DiskHealthIndicator,
  HealthCheck,
  HealthCheckService,
  MemoryHealthIndicator,
  TypeOrmHealthIndicator,
} from '@nestjs/terminus';
import { CapabilitiesService } from '@oppenheimer/backend-core';
import { CLIENT_CAPABILITIES, type DeploymentCapability } from '@oppenheimer/shared';
import { NoPolicy } from '../auth/decorators/check-policies.decorator';
import { AllowAnyScope } from '../auth/decorators/require-scopes.decorator';
import { CapabilitiesResponseDto } from './dtos/capabilities.response.dto';
import { RedisHealthIndicator } from './redis-health.indicator';

@ApiTags('Health')
@Controller()
export class HealthController {
  constructor(
    private health: HealthCheckService,
    private db: TypeOrmHealthIndicator,
    private memory: MemoryHealthIndicator,
    private disk: DiskHealthIndicator,
    private redis: RedisHealthIndicator,
    private capabilities: CapabilitiesService<DeploymentCapability>,
  ) {}

  @Get('health')
  @NoPolicy('public liveness probe')
  @HealthCheck()
  @ApiOperation({ summary: 'Liveness check' })
  @ApiResponse({ status: 200, description: 'App is alive' })
  check() {
    return this.health.check([() => this.memory.checkHeap('memory_heap', 200 * 1024 * 1024)]);
  }

  @Get('health/capabilities')
  @NoPolicy('public capability probe; already unauthenticated')
  // Anonymous callers already get this response (the login page reads it
  // before any session exists), so a scoped credential may too — without this
  // the global ScopesGuard fails closed and 403s API-token/OAuth callers.
  @AllowAnyScope()
  @ApiOperation({
    summary: 'Client-facing capabilities of this deployment',
  })
  @ApiResponse({
    status: 200,
    type: CapabilitiesResponseDto,
    description:
      'Which client-relevant optional features (OAuth providers, Stripe billing) this deployment has configured. `false` means not configured, not unhealthy. Server-internal capabilities are not exposed here.',
  })
  deploymentCapabilities(): CapabilitiesResponseDto {
    // Only the client-facing subset goes over the wire; the full registry
    // (S3, email transport, …) stays in the startup log and in-process.
    return this.capabilities.pick(CLIENT_CAPABILITIES);
  }

  @Get('ready')
  @NoPolicy('public readiness probe')
  @HealthCheck()
  @ApiOperation({ summary: 'Readiness check' })
  @ApiResponse({ status: 200, description: 'App is ready to receive traffic' })
  readiness() {
    return this.health.check([
      () => this.db.pingCheck('database'),
      () => this.redis.isHealthy('redis'),
      () => this.memory.checkHeap('memory_heap', 200 * 1024 * 1024),
      () =>
        this.disk.checkStorage('disk', {
          path: '/',
          thresholdPercent: 0.9,
        }),
    ]);
  }
}
