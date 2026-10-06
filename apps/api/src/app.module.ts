import { BullModule } from '@nestjs/bullmq';
import { type MiddlewareConsumer, Module, type NestModule } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { APP_FILTER, APP_GUARD } from '@nestjs/core';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { ThrottlerModule } from '@nestjs/throttler';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthzModule as AuthzKernelModule } from '@oppenheimer/backend-authz';
import { CacheModule } from '@oppenheimer/backend-cache';
import {
  AllExceptionsFilter,
  createAuthRouteLoggingMiddleware,
  LoggingModule,
  RequestContextMiddleware,
} from '@oppenheimer/backend-core';
import { EmailModule } from '@oppenheimer/backend-email';
import { I18nModule } from '@oppenheimer/backend-i18n';
import { LlmModule } from '@oppenheimer/backend-llm';
import { StorageModule } from '@oppenheimer/backend-storage';
// The JSON files directly, not the package root: that entry is a TypeScript
// source the API's CommonJS build cannot require at runtime.
import en from '@oppenheimer/translations/en/index.json';
import es from '@oppenheimer/translations/es/index.json';
import { AuthModule as BetterAuthModule } from '@thallesp/nestjs-better-auth';
import type Redis from 'ioredis';
import { AdminModule } from './admin/admin.module';
import { ApiTokensModule } from './api-tokens/api-tokens.module';
import { AuthModule } from './auth/auth.module';
import { ScopesGuard } from './auth/guards/scopes.guard';
import { auth } from './auth/infrastructure/better-auth.config';
import { bindSessionStore } from './auth/infrastructure/better-auth-secondary-storage.adapter';
import { AuthzModule } from './authz/authz.module';
import { AutomationsModule } from './automations/automations.module';
import { CalendarModule } from './calendar/calendar.module';
import { CapabilitiesModule } from './capabilities/capabilities.module';
import {
  appConfig,
  automationsConfig,
  calendarConfig,
  databaseConfig,
  emailConfig,
  githubAppConfig,
  hostsConfig,
  llmConfig,
  llmConfigFrom,
  oauthConfig,
  redisConfig,
  retentionConfig,
  sessionsConfig,
  storageConfig,
  throttlingConfig,
} from './config';
import { bootDataSourceFactory } from './config/boot-migrations';
import { type DatabaseConfig, poolOptions } from './config/database.config';
import { DEFAULT_JOB_OPTIONS } from './config/queue-options.config';
import { type RedisConfig, redisConnectionOptions } from './config/redis.config';
import type { ThrottlingConfig } from './config/throttling.config';
import { TypeOrmQueryLogger } from './config/typeorm-query.logger';
import { FeatureFlagsModule } from './feature-flags/feature-flags.module';
import { GithubModule } from './github/github.module';
import { HealthModule } from './health/health.module';
import { HostsModule } from './hosts/hosts.module';
import { InboundEventsModule } from './inbound-events/inbound-events.module';
import { OrganizationsModule } from './organizations/organizations.module';
import { OutboxModule } from './outbox/outbox.module';
import { ProfileModule } from './profile/profile.module';
import { ProjectsModule } from './projects/projects.module';
import { QueueModule } from './queue/queue.module';
import { REDIS_CLIENT } from './redis/redis.di-tokens';
import { RedisModule } from './redis/redis.module';
import { RelayModule } from './relay/relay.module';
import { RolesModule } from './roles/roles.module';
import { SessionsModule } from './sessions/sessions.module';
import { TasksModule } from './tasks/tasks.module';
import { CredentialThrottlerGuard } from './throttling/guards/credential-throttler.guard';
import { RedisThrottlerStorage } from './throttling/infrastructure/redis-throttler.adapter';
import { ThrottlingModule } from './throttling/throttling.module';
import { UsersModule } from './users/user.module';
import { WorkspaceEventsModule } from './workspace-events/workspace-events.module';

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
        githubAppConfig,
        hostsConfig,
        llmConfig,
        sessionsConfig,
        automationsConfig,
        calendarConfig,
        retentionConfig,
        throttlingConfig,
      ],
    }),
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
          // Pool size, connection wait and the statement, lock and
          // idle-in-transaction timeouts, tagged `api` in `pg_stat_activity`.
          extra: poolOptions(configService.get('database') as DatabaseConfig, 'api'),
          autoLoadEntities: true,
          synchronize: false,
          migrations: isTest ? [] : [`${__dirname}/migrations/*{.ts,.js}`],
          // Never on this DataSource: its pool carries the request timeouts.
          // `bootDataSourceFactory` runs them on a connection of their own.
          migrationsRun: false,
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
      // Runs pending migrations first, on a single connection without the
      // timeouts above; skipped under test (no migrations) and for the OpenAPI
      // build (`manualInitialization`).
      dataSourceFactory: bootDataSourceFactory(),
    }),
    // The one Redis command connection (`REDIS_CLIENT`) everything but BullMQ
    // shares, closed on shutdown. BullMQ opens its own from the same
    // `redisConnectionOptions` below.
    RedisModule,
    ThrottlerModule.forRootAsync({
      imports: [ThrottlingModule],
      inject: [RedisThrottlerStorage, ConfigService],
      useFactory: (storage: RedisThrottlerStorage, configService: ConfigService) => {
        const throttling = configService.getOrThrow<ThrottlingConfig>('throttling');
        return {
          throttlers: [
            { ttl: throttling.defaultWindowSeconds * 1000, limit: throttling.defaultLimit },
          ],
          // Integration tests drive many requests through the same pipeline in
          // seconds; rate limiting there measures nothing but the limit itself.
          skipIf: () => process.env.NODE_ENV === 'test',
          // Counters live in Redis so the limit is the limit, not the limit times
          // the replica count. See `RedisThrottlerStorage`.
          storage,
        };
      },
    }),
    BullModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        connection: redisConnectionOptions(configService.get('redis') as RedisConfig),
        // Every queue removes its finished jobs; a queue that needs retries
        // or a longer window sets its own in `QueueModule`.
        defaultJobOptions: DEFAULT_JOB_OPTIONS,
      }),
    }),
    EventEmitterModule.forRoot(),
    CapabilitiesModule,
    EmailModule.register(),
    StorageModule.register(),
    // Over the shared client, every key under `cache:`, so the cache never
    // mixes with BullMQ's `bull:*` or the throttler's `throttle:*`.
    CacheModule.registerAsync({
      inject: [REDIS_CLIENT],
      useFactory: (client: Redis) => ({ client, keyPrefix: 'cache:' }),
    }),
    // The deployment's LLM provider, for short best-effort calls (a session's
    // title). `none` by default; see `config/llm.config.ts`.
    LlmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => llmConfigFrom(configService),
    }),
    // `bodyParser.rawBody` attaches the raw request buffer to `req.rawBody`,
    // which the GitHub webhook controller needs for signature verification.
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
    // The console's change feed, global like the outbox: modules publish to it
    // after a commit (`product/versions/mvp/21-workspace-events.md`).
    WorkspaceEventsModule,
    // The bundles are the same JSON the web app loads, so a string
    // is written once and a translator edits one file — and an email, which
    // has no request to negotiate a language from, renders from the
    // recipient's stored preference instead.
    I18nModule.forRoot({
      bundles: { en, es },
      defaultLocale: 'en',
      defaultTimeZone: 'UTC',
    }),
    AuthzKernelModule.forRoot(),
    AuthModule,
    AuthzModule,
    ApiTokensModule,
    UsersModule,
    ProfileModule,
    RolesModule,
    // The Better Auth organization row is the personal workspace
    // (`product/versions/mvp/00-scope.md`); the roster and invitation routes
    // it ships stay until the teams slice needs them.
    OrganizationsModule,
    InboundEventsModule,
    GithubModule,
    HostsModule,
    AdminModule,
    FeatureFlagsModule,
    ProjectsModule,
    SessionsModule,
    AutomationsModule,
    TasksModule,
    CalendarModule,
    RelayModule,
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
    // Better Auth's session cache runs on the shared Redis connection. `auth`
    // is configured at module scope, so the connection is handed to it here,
    // once the injector has one, and taken back before `RedisModule` closes it.
    {
      provide: 'BETTER_AUTH_SESSION_STORE',
      inject: [REDIS_CLIENT],
      useFactory: (client: Redis) => bindSessionStore(client),
    },
  ],
})
export class AppModule implements NestModule {
  // The correlation id is opened in middleware, ahead of the guards above: a
  // 401, 403 or 429 a guard throws carries the same id as the log line and
  // the `x-correlation-id` response header. See `RequestContextMiddleware`.
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(RequestContextMiddleware).forRoutes('*');
  }
}
