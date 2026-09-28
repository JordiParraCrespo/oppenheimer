import { Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { ExternalEventSourcePort } from '../../inbound-events/application/external-event-source.port';
import type {
  ExternalEvent,
  InboundDelivery,
} from '../../inbound-events/domain/external-event.types';
import type { GithubInstallationRepositoryPort } from '../database/github-installation.repository.port';
import { GITHUB_INSTALLATION_REPOSITORY } from '../github.di-tokens';
import { GITHUB_WEBHOOK_EVENTS, normalizeGithubDelivery } from './github-event-normalizer.util';

/**
 * GitHub, as a source of the inbound-events hub. The endpoint and the secret
 * stay in this module's webhook slice; this adapter answers the two questions
 * only GitHub knows: which workspace an installation belongs to, and what a
 * delivery means in the trigger catalog's words.
 */
@Injectable()
export class GithubEventSource implements ExternalEventSourcePort {
  readonly id = 'github' as const;

  constructor(
    @Inject(GITHUB_INSTALLATION_REPOSITORY)
    private readonly installations: GithubInstallationRepositoryPort,
    private readonly config: ConfigService,
  ) {}

  accepts(eventName: string): boolean {
    return (GITHUB_WEBHOOK_EVENTS as readonly string[]).includes(eventName);
  }

  /**
   * One live installation, one workspace (`UQ_github_installation_live_github_id`).
   * A suspended installation still resolves: suspension stops token mints, and a
   * run that needs one will say so, which is more honest than an event that
   * silently never arrived.
   */
  async resolveTenants(delivery: InboundDelivery): Promise<string[]> {
    const installation = delivery.payload.installation as { id?: unknown } | undefined;
    const id = Number(installation?.id);
    if (!Number.isInteger(id) || id <= 0) return [];
    const found = await this.installations.findLiveByGithubInstallationId(id);
    return found.isSome() ? [found.unwrap().organizationId] : [];
  }

  normalize(delivery: InboundDelivery): ExternalEvent[] {
    const slug = this.config.get<string>('githubApp.slug');
    return normalizeGithubDelivery(delivery, {
      appSlug: slug,
      // The frames' handle. A deployment's App can be named anything; its bot
      // is `<slug>[bot]`, and a mention names the product, not the bot.
      mentionHandle: 'oppenheimer',
    });
  }
}
