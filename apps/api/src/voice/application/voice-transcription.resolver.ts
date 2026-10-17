import { Inject, Injectable, Logger } from '@nestjs/common';
import { AppError } from '@oppenheimer/backend-core';
import type { VoiceProvider } from '@oppenheimer/shared';
import type {
  TurnCredential,
  TurnCredentialsPort,
} from '../../bots/application/turn-credentials.port';
import { MODEL_PROVIDER_CREDENTIAL_REPOSITORY, TURN_CREDENTIALS } from '../../bots/bots.di-tokens';
import type { ModelProviderCredentialRepositoryPort } from '../../bots/database/model-provider-credential.repository.port';
import { VoiceErrors } from '../domain/voice.errors';
import type {
  ChatgptSpeechPort,
  KeyedSpeechPort,
  VoiceClip,
} from '../infrastructure/speech-to-text.port';
import { CHATGPT_SPEECH, KEYED_SPEECH } from '../voice.di-tokens';

/** What was heard, by whom, and the sign-in it was heard on (for the polish to run on too). */
export interface HeardClip {
  raw: string;
  provider: VoiceProvider;
  chatgpt: TurnCredential | null;
}

/**
 * Who hears a workspace's clip (`product/next-steps/voice.md`): its ChatGPT
 * sign-in (Settings → Model providers) when it has one, the deployment's own
 * speech-to-text server otherwise, and nobody (`VOICE_005`) when it has
 * neither.
 *
 * The sign-in is read and refreshed through the bots module's
 * `TURN_CREDENTIALS`, the same way a bot's turn reads it, so voice never
 * keeps a second copy of the tokens. ChatGPT's dictation route is
 * undocumented: when it cannot transcribe (`VOICE_006`) or the sign-in has
 * lapsed, a deployment with its own server tries that instead of failing the
 * dictation; a refusal for rate (`VOICE_007`) is not retried elsewhere.
 */
@Injectable()
export class VoiceTranscriptionResolver {
  private readonly logger = new Logger(VoiceTranscriptionResolver.name);

  constructor(
    @Inject(MODEL_PROVIDER_CREDENTIAL_REPOSITORY)
    private readonly providers: ModelProviderCredentialRepositoryPort,
    @Inject(TURN_CREDENTIALS) private readonly credentials: TurnCredentialsPort,
    @Inject(CHATGPT_SPEECH) private readonly chatgpt: ChatgptSpeechPort,
    @Inject(KEYED_SPEECH) private readonly keyed: KeyedSpeechPort,
  ) {}

  async hear(organizationId: string, clip: VoiceClip, now: Date): Promise<HeardClip> {
    const signedIn = (await this.providers.findForRun(organizationId, 'chatgpt')).isSome();
    if (!signedIn) return this.hearOnKey(clip);

    try {
      const access = await this.credentials.forTurn(organizationId, 'chatgpt', now);
      const raw = await this.chatgpt.transcribe(clip, {
        accessToken: access.apiKey,
        accountId: access.accountId,
      });
      return { raw, provider: 'chatgpt', chatgpt: access };
    } catch (error) {
      if (!this.keyed.isConfigured() || !this.mayFallBack(error)) throw error;
      this.logger.warn({
        message: "ChatGPT could not transcribe; using the deployment's speech server",
        organizationId,
        code: error instanceof AppError ? error.code : undefined,
      });
      return this.hearOnKey(clip);
    }
  }

  private async hearOnKey(clip: VoiceClip): Promise<HeardClip> {
    if (!this.keyed.isConfigured()) throw new AppError(VoiceErrors.NOT_CONFIGURED);
    return { raw: await this.keyed.transcribe(clip), provider: 'speech_key', chatgpt: null };
  }

  /** Anything but a rate limit: a refused or changed route, an unreachable ChatGPT, a lapsed sign-in. */
  private mayFallBack(error: unknown): boolean {
    return !(error instanceof AppError && error.code === VoiceErrors.RATE_LIMITED.code);
  }
}
