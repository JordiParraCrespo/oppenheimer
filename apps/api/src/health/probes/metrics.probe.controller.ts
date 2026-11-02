import { createHash, timingSafeEqual } from 'node:crypto';
import { Controller, Get, Headers, Inject, Logger, Res } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ApiExcludeController } from '@nestjs/swagger';
import { METRICS_REGISTRY, type Registry } from '@oppenheimer/backend-core';
import { NotFoundException } from '@oppenheimer/backend-ddd';
import type { Response } from 'express';
import { NoPolicy } from '../../auth/decorators/check-policies.decorator';

/**
 * The Prometheus scrape.
 *
 * It exists only for a caller holding `METRICS_TOKEN`: unset, or presented
 * wrong, the answer is the 404 any unknown path gets, so the endpoint does not
 * tell an outsider it is there. The series carry no identities (route groups,
 * status classes, queue names), but together they describe the deployment's
 * traffic and backlog, which is not the public's business.
 *
 * HTTP Basic, not a bearer: every bearer is a credential the global scopes
 * guard resolves (an API token, an OAuth grant, a session), and refuses when
 * it is none of them. Basic passes through that guard untouched, and is what
 * Prometheus' `basic_auth` sends. Out of the OpenAPI document: no client is
 * generated for a scrape.
 */
@ApiExcludeController()
@Controller()
export class MetricsProbeController {
  private readonly logger = new Logger(MetricsProbeController.name);

  constructor(
    @Inject(METRICS_REGISTRY) private readonly registry: Registry,
    private readonly configService: ConfigService,
  ) {}

  @Get('metrics')
  @NoPolicy('Prometheus scrape; gated by METRICS_TOKEN, not by a person')
  async scrape(
    @Headers('authorization') authorization: string | undefined,
    @Res({ passthrough: true }) response: Response,
  ): Promise<string> {
    const token = this.configService.get<string>('health.metricsToken');
    if (!token) throw new NotFoundException();
    if (!presentsToken(authorization, token)) {
      // Says only that a scrape was refused: a misconfigured Prometheus shows
      // up here, and the presented secret never does.
      this.logger.warn({ message: 'Metrics scrape refused: missing or wrong credential' });
      throw new NotFoundException();
    }
    response.setHeader('Content-Type', this.registry.contentType);
    return this.registry.metrics();
  }
}

/** Whether a Basic `Authorization` header carries `token` as its password, in constant time. */
export function presentsToken(authorization: string | undefined, token: string): boolean {
  const [scheme, encoded] = authorization?.split(' ') ?? [];
  if (scheme?.toLowerCase() !== 'basic' || !encoded) return false;
  const decoded = Buffer.from(encoded, 'base64').toString('utf8');
  const separator = decoded.indexOf(':');
  if (separator === -1) return false;
  // Digests, so the comparison is constant-time whatever the lengths.
  return timingSafeEqual(digest(decoded.slice(separator + 1)), digest(token));
}

function digest(value: string): Buffer {
  return createHash('sha256').update(value, 'utf8').digest();
}
