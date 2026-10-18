import { Injectable, Logger } from '@nestjs/common';
import { AppError } from '@oppenheimer/backend-core';
import type { VoiceProvider } from '@oppenheimer/shared';
import { VoiceErrors } from '../domain/voice.errors';
import type { VoiceClip } from '../infrastructure/speech-to-text.port';
import type { PolishModel } from './speech-provider.port';
import { SpeechProviderRegistry } from './speech-provider.registry';

/** What was heard, by whom, and the model credential the polish may run on. */
export interface HeardClip {
  raw: string;
  provider: VoiceProvider;
  polishOn: PolishModel | null;
}

/**
 * Who hears a workspace's clip (`product/next-steps/voice.md`): the first
 * provider in `SpeechProviderRegistry` available for the workspace, and the
 * next one when it fails. A refusal for rate (`VOICE_007`) is not retried on
 * another provider: it is the provider saying "not now", and spending a
 * second provider's budget on it hides that. When every available provider
 * failed, the first failure is the answer, since it is the provider the
 * workspace would have used; when none is available, `VOICE_005`.
 */
@Injectable()
export class VoiceTranscriptionResolver {
  private readonly logger = new Logger(VoiceTranscriptionResolver.name);

  constructor(private readonly registry: SpeechProviderRegistry) {}

  async hear(organizationId: string, clip: VoiceClip, now: Date): Promise<HeardClip> {
    let first: unknown = null;
    let tried = false;
    for (const provider of this.registry.all()) {
      try {
        // Asked here, in order, so a provider whose lookup fails is that
        // provider failing: the next one is still tried.
        if (!(await provider.availableFor(organizationId))) continue;
        tried = true;
        const grant = await provider.grantFor(organizationId, now);
        const raw = await provider.transcribe(clip, grant);
        return { raw, provider: provider.id, polishOn: grant.polishOn };
      } catch (error) {
        if (isRateLimit(error)) throw error;
        tried = true;
        first ??= error;
        // The detail says which answer it was ("answered 403 (as text/html)"):
        // the code alone says only that the provider refused, not why.
        const { code, detail } = error instanceof AppError ? error : {};
        this.logger.warn({
          message: 'A speech provider could not transcribe; trying the next',
          organizationId,
          provider: provider.id,
          code,
          detail,
        });
      }
    }
    if (tried) throw first;
    throw new AppError(VoiceErrors.NOT_CONFIGURED);
  }
}

function isRateLimit(error: unknown): boolean {
  return error instanceof AppError && error.code === VoiceErrors.RATE_LIMITED.code;
}
