import { Global, Logger, Module, OnApplicationBootstrap } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { CapabilitiesService } from '@oppenheimer/backend-core';
import type { DeploymentCapabilities } from '@oppenheimer/shared';
import { hostsAreConfigured } from '../config/hosts.config';

/**
 * Resolves this deployment's optional capabilities from config, once at boot.
 *
 * A capability is on only when everything it needs is actually present — a
 * missing optional key removes a feature, it never throws (see
 * `.agents/rules/api-config.md`). Required settings (database,
 * `BETTER_AUTH_SECRET`) are the opposite and are not listed here: they fail
 * boot loudly in their config schemas.
 */
export function resolveCapabilities(configService: ConfigService): DeploymentCapabilities {
  const emailProvider = configService.get<string>('email.provider');

  return {
    google_oauth: Boolean(
      configService.get('oauth.google.clientId') && configService.get('oauth.google.clientSecret'),
    ),
    github_oauth: Boolean(
      configService.get('oauth.github.clientId') && configService.get('oauth.github.clientSecret'),
    ),
    stripe_billing: Boolean(configService.get('stripe.secretKey')),
    s3_storage:
      configService.get('storage.provider') === 's3' &&
      Boolean(
        configService.get('storage.s3AccessKeyId') &&
          configService.get('storage.s3SecretAccessKey'),
      ),
    // The same predicate the host routes refuse on, called rather than
    // re-derived: a capability that says yes while every route answers
    // HOSTS_004 is a second source of truth, and the console reads this one.
    hosts: hostsAreConfigured(configService),
    // The `console` provider only prints to stdout — that is not delivery.
    email_delivery:
      (emailProvider === 'nodemailer' && Boolean(configService.get('email.smtpHost'))) ||
      (emailProvider === 'resend' && Boolean(configService.get('email.resendApiKey'))),
  };
}

/**
 * Global so any module can ask "does this deployment have X?" through
 * `CapabilitiesService` instead of re-deriving it from raw config keys.
 */
@Global()
@Module({
  providers: [
    {
      provide: CapabilitiesService,
      inject: [ConfigService],
      useFactory: (configService: ConfigService) =>
        new CapabilitiesService(resolveCapabilities(configService)),
    },
  ],
  exports: [CapabilitiesService],
})
export class CapabilitiesModule implements OnApplicationBootstrap {
  private readonly logger = new Logger('Capabilities');

  constructor(private readonly capabilities: CapabilitiesService) {}

  onApplicationBootstrap(): void {
    // One line, first thing after boot, answering "what can this deployment
    // do" — so a self-hoster learns a provider is off from the log, not from
    // a dead button or an opaque provider-side error.
    this.logger.log(`Deployment capabilities: ${this.capabilities.describe()}`);
  }
}
