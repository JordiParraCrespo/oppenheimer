import { Injectable, Logger } from '@nestjs/common';
import { AppError } from '@oppenheimer/backend-core';
import {
  SYNTHESIS_MODELS,
  type SynthesisProvider,
  synthesisVoiceFor,
  voiceModelFor,
} from '@oppenheimer/shared';
import { VoiceErrors } from '../domain/voice.errors';
import { chosenFirst } from '../domain/voice-preference.policy';
import { SynthesisProviderRegistry } from './synthesis-provider.registry';

/** The provider, model and voice the workspace chose to speak with; null is automatic. */
export interface SynthesisSettings {
  provider: SynthesisProvider | null;
  model: string | null;
  voice: string | null;
}

/** The text, spoken, and who spoke it. Not yet judged as a voice note. */
export interface SpokenText {
  audio: Buffer;
  provider: SynthesisProvider;
}

/**
 * Who speaks a workspace's voice note: the providers in
 * `SynthesisProviderRegistry`'s order, the one it chose moved first, the first
 * available for the workspace speaking it, the next one when it fails. The
 * fallback rule is dictation's (`provider-integrations.md`): a rate limit
 * (`VOICE_010`) is answered at once, the first failure is the answer when all
 * failed, `VOICE_008` when none is available. The chosen model and voice go to
 * the chosen provider only; any other speaks in its defaults, since a voice id
 * means nothing to another provider.
 */
@Injectable()
export class VoiceSynthesisResolver {
  private readonly logger = new Logger(VoiceSynthesisResolver.name);

  constructor(private readonly registry: SynthesisProviderRegistry) {}

  async speak(
    organizationId: string,
    text: string,
    now: Date,
    settings: SynthesisSettings,
  ): Promise<SpokenText> {
    let first: unknown = null;
    let tried = false;
    for (const provider of chosenFirst(this.registry.all(), settings.provider)) {
      try {
        if (!(await provider.availableFor(organizationId))) continue;
        tried = true;
        const chosen = provider.id === settings.provider;
        const access = await provider.grantFor(organizationId, now);
        const audio = await provider.synthesize(text, access, {
          model: voiceModelFor(SYNTHESIS_MODELS[provider.id], chosen ? settings.model : null),
          voice: synthesisVoiceFor(provider.id, chosen ? settings.voice : null),
        });
        return { audio, provider: provider.id };
      } catch (error) {
        if (error instanceof AppError && error.code === VoiceErrors.SYNTHESIS_RATE_LIMITED.code) {
          throw error;
        }
        tried = true;
        first ??= error;
        const { code, detail } = error instanceof AppError ? error : {};
        this.logger.warn({
          message: 'A synthesis provider could not speak; trying the next',
          organizationId,
          provider: provider.id,
          code,
          detail,
        });
      }
    }
    if (tried) throw first;
    throw new AppError(VoiceErrors.SYNTHESIS_NOT_CONFIGURED);
  }
}
