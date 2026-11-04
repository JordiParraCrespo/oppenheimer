import { Controller, Get, HttpStatus, Res } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { CapabilitiesService } from '@oppenheimer/backend-core';
import { CLIENT_CAPABILITIES, type DeploymentCapability } from '@oppenheimer/shared';
import type { Response } from 'express';
import { NoPolicy } from '../../auth/decorators/check-policies.decorator';
import { AllowAnyScope } from '../../auth/decorators/require-scopes.decorator';
import { CapabilitiesResponseDto } from '../dtos/capabilities.response.dto';
import { LivenessResponseDto, ReadinessResponseDto } from '../dtos/readiness.response.dto';
import { ReadinessIndicator } from './readiness.indicator';

/**
 * The probes. Public and unauthenticated on purpose: the deploy gate and the
 * container healthcheck call them before anything could hold a credential,
 * and nothing they answer describes the deployment beyond "can it serve".
 */
@ApiTags('Health')
@Controller()
export class HealthProbeController {
  constructor(
    private readinessIndicator: ReadinessIndicator,
    private capabilities: CapabilitiesService<DeploymentCapability>,
    private configService: ConfigService,
  ) {}

  /**
   * Checks nothing but that the process answers HTTP, which is the one thing
   * a restart fixes. A dependency here would restart a good process because
   * PostgreSQL blinked; a heap threshold would restart a busy one at its
   * peak, mid-request, when V8 itself already ends a process that really
   * runs out. Both belong to `/ready` and to the metrics.
   */
  @Get('health')
  @NoPolicy('public liveness probe')
  @ApiOperation({
    summary: 'Liveness check',
    description:
      'Answers 200 while the process can serve HTTP. Says nothing about PostgreSQL, Redis or any other dependency: that is `/ready`.',
  })
  @ApiResponse({ status: 200, type: LivenessResponseDto, description: 'The process answered' })
  check(): LivenessResponseDto {
    return { status: 'ok' };
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
      'Which client-relevant optional features (sign-in providers, the GitHub App, host pairing) this deployment has configured. `false` means not configured, not unhealthy. Server-internal capabilities are not exposed here.',
  })
  deploymentCapabilities(): CapabilitiesResponseDto {
    const flags = this.capabilities.pick(CLIENT_CAPABILITIES);
    const slug = this.configService.get<string>('githubApp.slug');

    return {
      ...flags,
      // Gated on the capability rather than the slug alone: the App is only
      // usable when all six settings are present, and a link offered without
      // them fails after the reader has left for GitHub.
      github_app_install_url:
        flags.github_app && slug ? `https://github.com/apps/${slug}/installations/new` : null,
    };
  }

  @Get('ready')
  @NoPolicy('public readiness probe')
  @ApiOperation({
    summary: 'Readiness check',
    description:
      'Answers 200 only when PostgreSQL and Redis both answer within their configured timeouts, and 503 otherwise. Why a dependency failed is logged, never returned.',
  })
  @ApiResponse({ status: 200, type: ReadinessResponseDto, description: 'This replica can serve' })
  @ApiResponse({
    status: 503,
    type: ReadinessResponseDto,
    description: 'A dependency is unavailable; this replica must not serve. Same body shape.',
  })
  async readiness(@Res({ passthrough: true }) response: Response): Promise<ReadinessResponseDto> {
    const result = await this.readinessIndicator.check();
    if (result.status !== 'ok') response.status(HttpStatus.SERVICE_UNAVAILABLE);
    return result;
  }
}
