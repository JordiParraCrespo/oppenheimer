import '@oppenheimer/env/load';
import type { ServerResponse } from 'node:http';
import { resolve } from 'node:path';
import { VersioningType } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { SwaggerModule } from '@nestjs/swagger';
import { SanitizePipe } from '@oppenheimer/backend-core';
import { BULL_BOARD_MIN_PASSWORD_LENGTH, setupBullBoard } from '@oppenheimer/backend-queue';
import { QUEUE_NAMES } from '@oppenheimer/shared';
import helmet from 'helmet';
import { Logger } from 'nestjs-pino';
import { ZodValidationPipe } from 'nestjs-zod';
import { AppModule } from './app.module';
import { createOpenApiDocument } from './openapi-document';

async function bootstrap() {
  // `bodyParser: false` is required by `@thallesp/nestjs-better-auth` so that
  // Better Auth can read the raw request body. The module re-registers the
  // JSON / urlencoded parsers for the rest of the controllers.
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    bufferLogs: true,
    bodyParser: false,
  });
  const configService = app.get(ConfigService);
  const logger = app.get(Logger);

  app.useLogger(logger);

  // Trust the configured number of reverse-proxy hops so `req.ip` is the real
  // client (the throttler keys on it, and API-token IP allowlists and audit
  // logs record it). 0 means no proxy — leave `trust proxy` off so a direct
  // client cannot spoof `X-Forwarded-For`.
  const trustProxy = configService.get<number>('app.trustProxy') ?? 0;
  if (trustProxy > 0) app.set('trust proxy', trustProxy);

  app.use(helmet());
  app.enableCors({
    origin: configService.getOrThrow<string>('app.frontendUrl'),
    credentials: true,
  });

  // The `local` storage backend hands the client an absolute `<publicUrl>/uploads/<key>`
  // pointing back here (`LocalStorageService`), since the documented Tier-1 serves the
  // SPA from another origin; it is mounted outside the `api` prefix to match. S3 hands
  // back signed URLs and needs no route.
  //
  // Only the `avatars/` subtree is mounted, never the upload root: this route has no
  // guard, which suits avatars (public, loaded cross-origin by an `<img>`). Anything
  // else added here must be public by nature too, or it needs a guarded route.
  if ((configService.get<string>('storage.provider') ?? 'local') === 'local') {
    const uploadDir = resolve(configService.get<string>('storage.uploadDir') ?? './uploads');
    app.useStaticAssets(resolve(uploadDir, 'avatars'), {
      prefix: '/uploads/avatars',
      // These files are public and loaded cross-origin by the SPA, so relax
      // helmet's default same-origin CORP for them — otherwise the browser
      // blocks the `<img>` and the avatar silently falls back to initials.
      setHeaders: (res: ServerResponse) => {
        res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
      },
    });
  }

  app.setGlobalPrefix('api');
  app.enableVersioning({ type: VersioningType.URI, defaultVersion: '1' });
  app.useGlobalPipes(new SanitizePipe(), new ZodValidationPipe());

  // Swagger UI maps the entire API surface; don't serve it in production, where
  // it is only an aid to an attacker. The OpenAPI JSON for the generated client
  // is emitted at build time by `generate-openapi.ts`, not from this route.
  if (configService.get<string>('app.nodeEnv') !== 'production') {
    const document = createOpenApiDocument(app);
    SwaggerModule.setup('api/docs', app, document);
  }

  // The Bull Board dashboard is only mounted when Basic-auth credentials are
  // configured — its job payloads carry tokenized reset/invitation URLs, so it
  // is never exposed unauthenticated. See `setupBullBoard`.
  const bullBoardUsername = configService.get<string>('app.bullBoardUsername');
  const bullBoardPassword = configService.get<string>('app.bullBoardPassword');
  const bullBoardMounted = setupBullBoard(
    app,
    [
      QUEUE_NAMES.EMAIL,
      QUEUE_NAMES.HOST_RETENTION,
      QUEUE_NAMES.INBOUND_EVENTS,
      QUEUE_NAMES.AUTOMATION_RUNS,
      QUEUE_NAMES.AUTOMATION_SCHEDULES,
      QUEUE_NAMES.AUTOMATION_RETENTION,
      QUEUE_NAMES.OUTBOX_RETENTION,
    ],
    bullBoardUsername && bullBoardPassword
      ? { auth: { username: bullBoardUsername, password: bullBoardPassword } }
      : {},
  );
  if (
    !bullBoardMounted &&
    bullBoardUsername &&
    bullBoardPassword &&
    bullBoardPassword.length < BULL_BOARD_MIN_PASSWORD_LENGTH
  ) {
    logger.warn({
      message: `Bull Board dashboard disabled: BULL_BOARD_PASSWORD must be at least ${BULL_BOARD_MIN_PASSWORD_LENGTH} characters`,
    });
  } else {
    logger.log({
      message: bullBoardMounted
        ? 'Bull Board dashboard mounted at /admin/queues (Basic auth)'
        : 'Bull Board dashboard disabled (set BULL_BOARD_USERNAME and BULL_BOARD_PASSWORD to enable)',
    });
  }

  const port = configService.get('app.port');
  await app.listen(port);
}

bootstrap();
