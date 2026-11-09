import 'reflect-metadata';
import {
  type INestApplication,
  type MiddlewareConsumer,
  Module,
  type NestModule,
  VersioningType,
} from '@nestjs/common';
import { CommandBus } from '@nestjs/cqrs';
import { Test } from '@nestjs/testing';
import { AllExceptionsFilter } from '@oppenheimer/backend-core';
import { AuthModule as BetterAuthModule } from '@thallesp/nestjs-better-auth';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  APP_BODY_PARSER_OPTIONS,
  GITHUB_WEBHOOK_BODY_LIMIT_BYTES,
  githubWebhookBodyParser,
} from '../../../infrastructure/github-webhook-body.util';
import { HandleGithubWebhookCommand } from '../handle-github-webhook.command';
import { HandleGithubWebhookHttpController } from '../handle-github-webhook.http.controller';

/**
 * The parsers a delivery goes through before the controller: Better Auth's
 * app-wide JSON parser, configured as `AppModule` configures it, and the
 * webhook's own, applied as `GithubModule` applies it. The bus is stubbed;
 * what the handler does with the bytes is its own spec's.
 */

const execute = vi.fn();

@Module({
  imports: [
    BetterAuthModule.forRoot({
      auth: { options: {}, handler: async () => new Response(null, { status: 404 }) } as never,
      disableGlobalAuthGuard: true,
      bodyParser: APP_BODY_PARSER_OPTIONS,
    }),
  ],
  controllers: [HandleGithubWebhookHttpController],
  providers: [{ provide: CommandBus, useValue: { execute } }],
})
class WebhookPipelineModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(githubWebhookBodyParser()).forRoutes(HandleGithubWebhookHttpController);
  }
}

describe('POST /v1/github/webhook', () => {
  let app: INestApplication;
  let base: string;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [WebhookPipelineModule],
    }).compile();

    app = moduleRef.createNestApplication({ bodyParser: false });
    app.setGlobalPrefix('api');
    app.enableVersioning({ type: VersioningType.URI, defaultVersion: '1' });
    app.useGlobalFilters(new AllExceptionsFilter());
    await app.listen(0);
    base = `${(await app.getUrl()).replace('[::1]', '127.0.0.1')}/api/v1`;
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => {
    execute.mockReset().mockResolvedValue(undefined);
  });

  const deliver = (body: BodyInit, headers: Record<string, string> = {}) =>
    fetch(`${base}/github/webhook`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-github-event': 'push',
        'x-github-delivery': 'd-1',
        'x-hub-signature-256': 'sha256=signed-elsewhere',
        ...headers,
      },
      body,
      duplex: 'half',
    } as RequestInit);

  const handed = () => execute.mock.calls[0]?.[0] as HandleGithubWebhookCommand;

  it('hands a delivery past the app-wide JSON limit to the bus, byte for byte', async () => {
    // Regression (OPPENHEIMER-API-2): a 200 kB `push` answered 500.
    const json = `{"ref":"refs/heads/main","commits":[${'{"message":"ü"},'.repeat(80_000)}{}]}`;
    const sent = Buffer.from(json, 'utf8');
    expect(sent.length).toBeGreaterThan(1_000_000);

    const response = await deliver(sent);

    expect(response.status).toBe(200);
    expect(handed()).toBeInstanceOf(HandleGithubWebhookCommand);
    expect(handed().payload.equals(sent)).toBe(true);
    expect(handed()).toMatchObject({ event: 'push', deliveryId: 'd-1' });
  });

  it('keeps the bytes of a form-encoded delivery too, unparsed', async () => {
    const sent = Buffer.from(
      `payload=${encodeURIComponent('{"zen":"Keep it logically awesome."}')}`,
    );

    const response = await deliver(sent, { 'content-type': 'application/x-www-form-urlencoded' });

    expect(response.status).toBe(200);
    expect(handed().payload.equals(sent)).toBe(true);
  });

  it("refuses a body past GitHub's 25 MB cap with 413, before the bus", async () => {
    const response = await deliver(Buffer.alloc(GITHUB_WEBHOOK_BODY_LIMIT_BYTES + 1, 0x20));

    expect(response.status).toBe(413);
    expect(response.headers.get('content-type')).toContain('application/problem+json');
    await expect(response.json()).resolves.toMatchObject({
      status: 413,
      title: 'Payload Too Large',
    });
    expect(execute).not.toHaveBeenCalled();
  });

  it('stops reading a chunked body that never declared a length once it crosses the cap', async () => {
    const chunk = new Uint8Array(1024 * 1024).fill(0x20);
    let sent = 0;
    const endless = new ReadableStream<Uint8Array>({
      pull(controller) {
        // Well past the cap, and finite, so a reader that ignored it would still end.
        if (sent > 2 * GITHUB_WEBHOOK_BODY_LIMIT_BYTES) return controller.close();
        sent += chunk.length;
        controller.enqueue(chunk);
      },
    });

    const response = await deliver(endless);

    expect(response.status).toBe(413);
    expect(execute).not.toHaveBeenCalled();
  });

  it('leaves every other path on the app-wide limit', async () => {
    // The app-wide parser runs on every path, routed or not, before routing.
    const body = JSON.stringify({ pad: 'x'.repeat(200_000) });
    const response = await fetch(`${base}/github/webhooks`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body,
    });

    expect(response.status).toBe(413);
  });
});
