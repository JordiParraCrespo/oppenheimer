import { Injectable, Logger } from '@nestjs/common';
import { TRANSCRIPTION_MODELS, type VoiceProvider, voiceModelFor } from '@oppenheimer/shared';
import { VoiceErrors } from '../domain/voice.errors';
import { withoutSilenceHallucinations } from '../domain/voice-speech.policy';
import type { VoiceClip } from '../infrastructure/speech-to-text.port';
import { firstProviderAnswer } from './provider-fallback.policy';
import type { PolishModel } from './speech-provider.port';
import { SpeechProviderRegistry } from './speech-provider.registry';

/**
 * What was heard, by whom, and the model credential the polish may run on.
 * `raw` is without the subtitle credits a speech model makes up from silence,
 * so a clip of nothing is empty rather than "Thanks for watching!".
 */
export interface HeardClip {
  raw: string;
  provider: VoiceProvider;
  polishOn: PolishModel | null;
}

/** The provider and model the workspace chose to hear with (Settings → Model providers); null is automatic. */
export interface TranscriptionChoice {
  provider: VoiceProvider | null;
  model: string | null;
}

const AUTOMATIC: TranscriptionChoice = { provider: null, model: null };

/**
 * Who hears a workspace's clip: the providers in `SpeechProviderRegistry`'s
 * order, the one it chose (Settings → Model providers) moved first, the first
 * available for the workspace hearing it, and the next one when it fails. A
 * refusal for rate (`VOICE_007`) is not retried on another provider: it is the provider
 * saying "not now", and spending a second provider's budget on it hides that.
 * When every available provider failed, the first failure is the answer, since
 * it is the provider the workspace would have used; when none is available,
 * `VOICE_005`.
 */
@Injectable()
export class VoiceTranscriptionResolver {
  private readonly logger = new Logger(VoiceTranscriptionResolver.name);

  constructor(private readonly registry: SpeechProviderRegistry) {}

  async hear(
    organizationId: string,
    clip: VoiceClip,
    now: Date,
    choice: TranscriptionChoice = AUTOMATIC,
  ): Promise<HeardClip> {
    return firstProviderAnswer({
      organizationId,
      providers: this.registry.all(),
      chosen: choice.provider,
      rateLimited: VoiceErrors.RATE_LIMITED,
      notConfigured: VoiceErrors.NOT_CONFIGURED,
      logger: this.logger,
      failed: 'A speech provider could not transcribe; trying the next',
      attempt: async (provider, isChosen) => {
        const grant = await provider.grantFor(organizationId, now);
        // The chosen model goes to the chosen provider only; any other runs its default.
        const model = voiceModelFor(
          TRANSCRIPTION_MODELS[provider.id],
          isChosen ? choice.model : null,
        );
        const heard = await provider.transcribe(model ? { ...clip, model } : clip, grant);
        const raw = withoutSilenceHallucinations(heard);
        return { raw, provider: provider.id, polishOn: grant.polishOn };
      },
    });
  }
}
