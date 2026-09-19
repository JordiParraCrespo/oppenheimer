import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { APP_FILTER, APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { ThrottlerModule } from '@nestjs/throttler';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthzModule as AuthzKernelModule } from '@oppenheimer/backend-authz';
import { CacheModule } from '@oppenheimer/backend-cache';
import {
  AllExceptionsFilter,
  createAuthRouteLoggingMiddleware,
  LoggingModule,
  RequestContextInterceptor,
} from '@oppenheimer/backend-core';
import { EmailModule } from '@oppenheimer/backend-email';
import { I18nModule } from '@oppenheimer/backend-i18n';
import { StorageModule } from '@oppenheimer/backend-storage';
// The JSON files directly, not the package root: that entry is a TypeScript
// source the API's CommonJS build cannot require at runtime.
import en from '@oppenheimer/translations/en/index.json';
import es from '@oppenheimer/translations/es/index.json';
import { AuthModule as BetterAuthModule } from '@thallesp/nestjs-better-auth';
import { AdminModule } from './admin/admin.module';
import { ApiTokensModule } from './api-tokens/api-tokens.module';
import { AuthModule } from './auth/auth.module';
import { ScopesGuard } from './auth/guards/scopes.guard';
import { auth } from './auth/infrastructure/better-auth.config';
import { AuthzModule } from './authz/authz.module';
import { CapabilitiesModule } from './capabilities/capabilities.module';
import {
  appConfig,
  databaseConfig,
  emailConfig,
  githubAppConfig,
  hostsConfig,
  oauthConfig,
  redisConfig,
  storageConfig,
  stripeConfig,
} from './config';
import { TypeOrmQueryLogger } from './config/typeorm-query.logger';
import { GithubModule } from './github/github.module';
import { HealthModule } from './health/health.module';
import { HostsModule } from './hosts/hosts.module';
import { OrganizationsModule } from './organizations/organizations.module';
import { OutboxModule } from './outbox/outbox.module';
import { ProfileModule } from './profile/profile.module';
import { ProjectsModule } from './projects/projects.module';
import { QueueModule } from './queue/queue.module';
import { RolesModule } from './roles/roles.module';
import { CredentialThrottlerGuard } from './throttling/guards/credential-throttler.guard';
import { RedisThrottlerStorage } from './throttling/infrastructure/redis-throttler.adapter';
import { ThrottlingModule } from './throttling/throttling.module';
import { UsersModule } from './users/user.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [
        appConfig,
        databaseConfig,
        redisConfig,
        emailConfig,
        storageConfig,
        oauthConfig,
        stripeConfig,
        githubAppConfig,
        hostsConfig,
      ],
    }),
    // Request logging with hardened defaults (credential redaction, no
    // headers/query/bodies) plus the interceptor that attaches userId and
    // scopes to every request's log context. See `LoggingModule` in
    // `@oppenheimer/backend-core`.
    LoggingModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        pretty: configService.get('app.nodeEnv') !== 'production',
        // SQL query lines are emitted at debug; the opt-in is pointless if
        // the logger's threshold (info by default) swallows them.
        level: configService.get('database.logQueries') ? 'debug' : undefined,
      }),
    }),
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => {
        // Under the test runner, skip migrations entirely: TypeORM would load
        // the .ts migration files through vitest's module system and crash.
        // Migrations are exercised separately against a real database.
        const isTest = configService.get('app.nodeEnv') === 'test';
        // Building the OpenAPI document only needs the module graph, not a
        // live database, so `pnpm generate:openapi` runs anywhere.
        const isSchemaOnly = process.env.OPENAPI_GENERATION === 'true';
        return {
          type: 'postgres',
          manualInitialization: isSchemaOnly,
          host: configService.get('database.host'),
          port: configService.get('database.port'),
          username: configService.get('database.username'),
          password: configService.get('database.password'),
          database: configService.get('database.database'),
          autoLoadEntities: true,
          // Schema is managed through versioned migrations, never auto-sync.
          synchronize: false,
          migrations: isTest ? [] : [`${__dirname}/migrations/*{.ts,.js}`],
          migrationsRun: !isTest,
          // Opt-in query logging (`DB_LOG_QUERIES=true`), off by default. The
          // custom logger drops bound parameters — they carry user data.
          ...(configService.get('database.logQueries')
            ? {
                logging: ['query', 'warn', 'error'] as const,
                logger: new TypeOrmQueryLogger(),
              }
            : {}),
        };
      },
    }),
    ThrottlerModule.forRootAsync({
      imports: [ThrottlingModule],
      inject: [RedisThrottlerStorage],
      useFactory: (storage: RedisThrottlerStorage) => ({
        throttlers: [{ ttl: 60000, limit: 100 }],
        // Integration tests drive many requests through the same pipeline in
        // seconds; rate limiting there measures nothing but the limit itself.
        skipIf: () => process.env.NODE_ENV === 'test',
        // Counters live in Redis so the limit is the limit, not the limit times
        // the replica count. See `RedisThrottlerStorage`.
        storage,
      }),
    }),
    BullModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        connection: {
          host: configService.get('redis.host'),
          port: configService.get('redis.port'),
          password: configService.get('redis.password'),
        },
      }),
    }),
    EventEmitterModule.forRoot(),
    CapabilitiesModule,
    EmailModule.register(),
    StorageModule.register(),
    CacheModule.register(),
    // `bodyParser.rawBody` attaches the raw request buffer to `req.rawBody`,
    // which the Stripe webhook controller needs for signature verification.
    //
    // `middleware` is what gets `/api/auth/*` into the request log: Better
    // Auth mounts its handler straight onto the HTTP adapter before Nest
    // binds consumer middleware, so the `nestjs-pino` logger never sees those
    // routes. The wrapper logs them with the same hardened defaults.
    BetterAuthModule.forRoot({
      auth,
      disableGlobalAuthGuard: true,
      bodyParser: { rawBody: true },
      middleware: createAuthRouteLoggingMiddleware({
        pretty: process.env.NODE_ENV !== 'production',
      }),
    }),
    OutboxModule,
    // Server-side translation. The bundles are the same JSON the web and
    // mobile apps load, so a string is written once and a translator edits one
    // file — and an email, which has no request to negotiate a language from,
    // renders from the recipient's stored preference instead.
    I18nModule.forRoot({
      bundles: { en, es },
      defaultLocale: 'en',
      defaultTimeZone: 'UTC',
    }),
    // The kernel's registry is global; feature modules contribute their
    // resource declarations via AuthzModule.forFeature().
    AuthzKernelModule.forRoot(),
    AuthModule,
    AuthzModule,
    ApiTokensModule,
    UsersModule,
    ProfileModule,
    RolesModule,
    // The Better Auth organization row is the personal workspace
    // (`product/versions/mvp/00-scope.md`); the roster and invitation routes
    // it ships stay until the teams slice needs them. The starter's `leads`
    // reference module and `billing` are not composed: they are not in the
    // MVP and the product contexts (hosts, installations, projects, sessions,
    // relay) take their place here as they land.
    OrganizationsModule,
    // What GitHub grants a workspace, and how the platform exercises it. The
    // first of the product contexts named above.
    GithubModule,
    // The control plane's own modules. `hosts` is first of them: the machines a
    // person paired, and the credential a runner authenticates with.
    HostsModule,
    AdminModule,
    // The control plane's own modules, in the order their slices land.
    ProjectsModule,
    HealthModule,
    QueueModule,
  ],
  providers: [
    // Keyed on the calling credential, not the source IP — see the guard.
    { provide: APP_GUARD, useClass: CredentialThrottlerGuard },
    // Registered globally so a route that forgets to declare its scope
    // requirements is closed to scoped credentials rather than open by
    // omission. Browser sessions pass straight through.
    { provide: APP_GUARD, useClass: ScopesGuard },
    { provide: APP_FILTER, useClass: AllExceptionsFilter },
    { provide: APP_INTERCEPTOR, useClass: RequestContextInterceptor },
  ],
})
export class AppModule {}
