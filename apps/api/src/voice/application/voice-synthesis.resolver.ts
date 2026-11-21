import { Inject, Injectable, Logger } from '@nestjs/common';
import { AppError } from '@oppenheimer/backend-core';
import {
  SYNTHESIS_MODELS,
  type SynthesisProvider,
  synthesisVoiceFor,
  voiceModelFor,
} from '@oppenheimer/shared';
import { VoiceErrors } from '../domain/voice.errors';
import { oggOpusSeconds, spokeNothing } from '../domain/voice-synthesis.policy';
import type { SpokenAudioPort } from '../infrastructure/spoken-audio.port';
import { SPOKEN_AUDIO } from '../voice.di-tokens';
import { firstProviderAnswer } from './provider-fallback.policy';
import { SynthesisProviderRegistry } from './synthesis-provider.registry';

/** The provider, model and voice the workspace chose to speak with; null is automatic. */
export interface SynthesisSettings {
  provider: SynthesisProvider | null;
  model: string | null;
  voice: string | null;
}

/** The text, spoken as Ogg/Opus, who spoke it, and how long it runs in whole seconds. */
export interface SpokenText {
  audio: Buffer;
  provider: SynthesisProvider;
  seconds: number;
}

/**
 * Who speaks a workspace's voice note: the providers in
 * `SynthesisProviderRegistry`'s order, the one it chose moved first, the first
 * available for the workspace speaking it, the next one when it fails. The
 * fallback rule is dictation's (`provider-integrations.md`): a rate limit
 * (`VOICE_010`) is answered at once, the first failure is the answer when all
 * failed, `VOICE_008` when none is available. An answer that is not Ogg/Opus
 * is that provider failing (`VOICE_009`), judged here so the next one is tried;
 * so is Ogg/Opus that decodes to silence, which has a length and plays
 * nothing.
 * The chosen model and voice go to the chosen provider only; any other speaks
 * in its defaults, since a voice id means nothing to another provider.
 */
@Injectable()
export class VoiceSynthesisResolver {
  private readonly logger = new Logger(VoiceSynthesisResolver.name);

  constructor(
    private readonly registry: SynthesisProviderRegistry,
    @Inject(SPOKEN_AUDIO) private readonly spokenAudio: SpokenAudioPort,
  ) {}

  async speak(
    organizationId: string,
    text: string,
    now: Date,
    settings: SynthesisSettings,
  ): Promise<SpokenText> {
    return firstProviderAnswer({
      organizationId,
      providers: this.registry.all(),
      chosen: settings.provider,
      rateLimited: VoiceErrors.SYNTHESIS_RATE_LIMITED,
      notConfigured: VoiceErrors.SYNTHESIS_NOT_CONFIGURED,
      logger: this.logger,
      failed: 'A synthesis provider could not speak; trying the next',
      attempt: async (provider, isChosen) => {
        const access = await provider.grantFor(organizationId, now);
        const model = voiceModelFor(
          SYNTHESIS_MODELS[provider.id],
          isChosen ? settings.model : null,
        );
        const audio = await provider.synthesize(text, access, {
          model,
          voice: synthesisVoiceFor(provider.id, isChosen ? settings.voice : null, model),
        });
        const seconds = oggOpusSeconds(audio);
        if (seconds === null) {
          throw new AppError(VoiceErrors.SYNTHESIS_UNAVAILABLE, {
            detail: `The text-to-speech provider (${provider.id}) did not answer Ogg/Opus audio.`,
          });
        }
        if (spokeNothing(await this.spokenAudio.peak(audio))) {
          throw new AppError(VoiceErrors.SYNTHESIS_UNAVAILABLE, {
            detail: `The text-to-speech provider (${provider.id}) answered audio that plays no sound.`,
          });
        }
        return { audio, provider: provider.id, seconds };
      },
    });
  }
}
