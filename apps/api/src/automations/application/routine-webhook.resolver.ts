import { Inject, Injectable, Logger } from '@nestjs/common';
import { CacheService } from '@oppenheimer/backend-cache';
import { AppError, type KeySealer } from '@oppenheimer/backend-core';
import {
  AUTOMATION_REPOSITORY,
  AUTOMATION_WEBHOOK_REPOSITORY,
  WEBHOOK_SECRET_SEALER,
} from '../automations.di-tokens';
import type { AutomationRepositoryPort } from '../database/automation.repository.port';
import type {
  AutomationWebhookRepositoryPort,
  RoutineWebhookRecord,
} from '../database/automation-webhook.repository.port';
import type { AutomationEntity } from '../domain/automation.entity';
import type { AutomationTriggerProps } from '../domain/automation.types';
import { AutomationErrors } from '../domain/automations.errors';
import {
  isWebhookTokenShaped,
  SIGNATURE_REPLAY_TTL_SECONDS,
  type SignatureVerdict,
  signatureReplayKey,
  verifyWebhookSignature,
  webhookTokenHash,
} from '../domain/routine-webhook.policy';

/** What a POST to a routine's URL is checked with: exactly the bytes sent, and their signature. */
export interface WebhookRequest {
  token: string;
  body: Buffer;
  signature: string | undefined;
}

export interface WebhookTarget {
  routine: AutomationEntity;
  trigger: Extract<AutomationTriggerProps, { source: 'webhook' }>;
}

const SIGNATURE_DETAIL: Record<Exclude<SignatureVerdict, 'valid'>, string> = {
  missing: 'This webhook is signed: send x-oppenheimer-signature',
  malformed: 'x-oppenheimer-signature must read t=<unix seconds>,v1=<hex HMAC-SHA256>',
  stale: 'The signature’s timestamp is more than five minutes from now',
  mismatch: 'The signature does not match the body',
};
const REPLAYED_DETAIL = 'This signed request was already received: sign it again to send it again';

/**
 * The routine a POST to a webhook URL is for, authenticated: its token names
 * a live routine that still has a webhook trigger (else 404, with no hint of
 * which part failed), and a signed URL's request carries a fresh signature
 * over exactly its bytes, not one already received (else 401).
 */
@Injectable()
export class RoutineWebhookResolver {
  private readonly logger = new Logger(RoutineWebhookResolver.name);

  constructor(
    @Inject(AUTOMATION_WEBHOOK_REPOSITORY)
    private readonly webhooks: AutomationWebhookRepositoryPort,
    @Inject(AUTOMATION_REPOSITORY)
    private readonly automations: AutomationRepositoryPort,
    @Inject(WEBHOOK_SECRET_SEALER)
    private readonly sealer: KeySealer,
    private readonly cache: CacheService,
  ) {}

  async require(request: WebhookRequest, now: Date): Promise<WebhookTarget> {
    if (!isWebhookTokenShaped(request.token)) {
      throw new AppError(AutomationErrors.WEBHOOK_NOT_FOUND);
    }
    const webhook = await this.webhooks.findByTokenHash(webhookTokenHash(request.token));
    if (!webhook) throw new AppError(AutomationErrors.WEBHOOK_NOT_FOUND);

    const found = await this.automations.findOneByIdForSystem(webhook.automationId);
    const routine = found.isSome() ? found.unwrap() : null;
    const trigger = routine?.triggers.find(
      (candidate): candidate is WebhookTarget['trigger'] => candidate.source === 'webhook',
    );
    if (!routine || routine.isDeleted || routine.target.kind !== 'bot' || !trigger) {
      throw new AppError(AutomationErrors.WEBHOOK_NOT_FOUND);
    }
    await this.assertSigned(webhook, request, now);
    return { routine, trigger };
  }

  private async assertSigned(
    webhook: RoutineWebhookRecord,
    request: WebhookRequest,
    now: Date,
  ): Promise<void> {
    if (!webhook.signingSecretSealed) return;
    let secret: string;
    try {
      secret = this.sealer.open(webhook.signingSecretSealed);
    } catch (error) {
      // The key was removed or replaced: nothing can be checked, so nothing runs.
      this.logger.error({
        message: 'A webhook signing secret could not be opened',
        automationId: webhook.automationId,
        error: error instanceof Error ? error.message : String(error),
      });
      throw new AppError(AutomationErrors.WEBHOOK_SIGNING_UNAVAILABLE);
    }
    const verdict = verifyWebhookSignature(secret, request.signature, request.body, now);
    if (verdict !== 'valid') {
      throw new AppError(AutomationErrors.WEBHOOK_SIGNATURE_INVALID, {
        detail: SIGNATURE_DETAIL[verdict],
      });
    }
    // Claimed in one command, so two copies of one request racing run once.
    const first = await this.cache.setIfAbsent(
      signatureReplayKey(webhook.automationId, request.signature ?? '', request.body),
      now.toISOString(),
      SIGNATURE_REPLAY_TTL_SECONDS,
    );
    if (!first) {
      throw new AppError(AutomationErrors.WEBHOOK_SIGNATURE_INVALID, { detail: REPLAYED_DETAIL });
    }
  }
}
