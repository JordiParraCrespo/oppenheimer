/**
 * Request metrics through Nest's real router, URI versioning and a guard, with
 * the API's own route policy: the template the router reports is the one the
 * policy is written against, a refusal is counted, and nothing from the URL
 * reaches a label. Lives here, not in `health/`, because it declares the
 * stand-in controllers it routes to.
 */
import {
  Controller,
  ForbiddenException,
  Get,
  type INestApplication,
  UseGuards,
  VersioningType,
} from '@nestjs/common';
import { Test } from '@nestjs/testing';
import {
  HttpMetricsModule,
  METRICS_REGISTRY,
  MetricsModule,
  type Registry,
} from '@oppenheimer/backend-core';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { apiHttpMetricsOptions } from '../health/infrastructure/http-metrics.config';

@Controller('hosts')
class FakeHostsController {
  @Get()
  list(): object {
    return { data: [] };
  }

  @Get(':hostId')
  @UseGuards({
    canActivate: () => {
      throw new ForbiddenException();
    },
  })
  one(): void {}
}

@Controller()
class FakeProbeController {
  @Get('health')
  health(): object {
    return { status: 'ok' };
  }
}

describe('HTTP metrics through Nest routing, versioning and guards', () => {
  let app: INestApplication;
  let url: string;
  let registry: Registry;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [
        MetricsModule.forRoot({ defaultMetrics: false }),
        HttpMetricsModule.register(apiHttpMetricsOptions),
      ],
      controllers: [FakeHostsController, FakeProbeController],
    }).compile();
    app = moduleRef.createNestApplication({ logger: false });
    // As `main.ts` mounts the real API, so the templates the router reports
    // are the ones the policy is written against.
    app.setGlobalPrefix('api');
    app.enableVersioning({ type: VersioningType.URI, defaultVersion: '1' });
    await app.listen(0, '127.0.0.1');
    url = await app.getUrl();
    registry = app.get(METRICS_REGISTRY);
  });

  afterAll(async () => {
    await app?.close();
  });

  it('records successes, guard refusals and unknown paths without any identifier', async () => {
    expect((await fetch(`${url}/api/v1/hosts`)).status).toBe(200);
    expect((await fetch(`${url}/api/v1/hosts/host-7f3a`)).status).toBe(403);
    expect((await fetch(`${url}/api/v1/nowhere/secret-id?token=not-a-real-secret`)).status).toBe(
      404,
    );
    expect((await fetch(`${url}/api/v1/health`)).status).toBe(200);

    const exposition = await registry.metrics();
    expect(exposition).toContain('http_requests_total{route="hosts",status_class="2xx"} 1');
    expect(exposition).toContain('http_requests_total{route="hosts",status_class="4xx"} 1');
    expect(exposition).toContain('http_requests_total{route="other",status_class="4xx"} 1');
    expect(exposition).toContain('http_requests_total{route="sessions",status_class="5xx"} 0');
    expect(exposition).not.toContain('host-7f3a');
    expect(exposition).not.toContain('not-a-real-secret');
    // the probe is not traffic
    expect(exposition).not.toMatch(/route="health"/);
  });
});
