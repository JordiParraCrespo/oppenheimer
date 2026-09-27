import '@oppenheimer/env/load';
import type { ServerResponse } from 'node:http';
import { resolve } from 'node:path';
import { VersioningType } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { ProblemDetailsDto, SanitizePipe } from '@oppenheimer/backend-core';
import { setupBullBoard } from '@oppenheimer/backend-queue';
import { QUEUE_NAMES } from '@oppenheimer/shared';
import helmet from 'helmet';
import { Logger } from 'nestjs-pino';
import { patchNestJsSwagger, ZodValidationPipe } from 'nestjs-zod';
import { AppModule } from './app.module';

patchNestJsSwagger();

export function createSwaggerConfig() {
  return new DocumentBuilder()
    .setTitle('Oppenheimer API')
    .setDescription('Oppenheimer REST API documentation')
    .setVersion('0.1.0')
    .addBearerAuth()
    .build();
}

export function createSwaggerDocument(
  app: ReturnType<typeof NestFactory.create> extends Promise<infer T> ? T : never,
) {
  return SwaggerModule.createDocument(app, createSwaggerConfig(), {
    operationIdFactory: (_controller, method) => method,
    // Every error response references this schema (RFC 7807), so it must be in
    // the document even if a route documents its failures loosely.
    extraModels: [ProblemDetailsDto],
  });
}

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

  // Serve locally-stored avatars over HTTP. The `local` storage backend writes
  // an avatar to `<uploadDir>/<key>` and hands the client an absolute
  // `<publicUrl>/uploads/<key>` pointing back here (see `LocalStorageService`),
  // so the browser loads it from the API regardless of where the SPA is hosted —
  // the documented Tier-1 serves the web app from a different origin. Mount it
  // outside the `api` global prefix to match that URL. The S3 backend hands back
  // absolute signed URLs and needs no route, so this is gated on the local
  // provider.
  //
  // **Only the `avatars/` subtree is mounted, never the upload root.** This
  // route has no guard — that is deliberate for avatars, which are public by
  // nature and loaded cross-origin by an `<img>` tag. Anything else written to
  // the upload directory must be public by nature too before it is added here,
  // or it needs a guarded route of its own.
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
    const document = createSwaggerDocument(app);
    SwaggerModule.setup('api/docs', app, document);
  }

  // The Bull Board dashboard is only mounted when Basic-auth credentials are
  // configured — its job payloads carry tokenized reset/invitation URLs, so it
  // is never exposed unauthenticated. See `setupBullBoard`.
  const bullBoardUsername = configService.get<string>('app.bullBoardUsername');
  const bullBoardPassword = configService.get<string>('app.bullBoardPassword');
  const bullBoardMounted = setupBullBoard(
    app,
    [QUEUE_NAMES.EMAIL, QUEUE_NAMES.FILE_PROCESSING, QUEUE_NAMES.HOST_RETENTION],
    bullBoardUsername && bullBoardPassword
      ? { auth: { username: bullBoardUsername, password: bullBoardPassword } }
      : {},
  );
  logger.log({
    message: bullBoardMounted
      ? 'Bull Board dashboard mounted at /admin/queues (Basic auth)'
      : 'Bull Board dashboard disabled (set BULL_BOARD_USERNAME and BULL_BOARD_PASSWORD to enable)',
  });

  const port = configService.get('app.port');
  await app.listen(port);
}

bootstrap();
