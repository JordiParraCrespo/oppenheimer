import { Inject, Injectable } from '@nestjs/common';
import type {
  TurnCredential,
  TurnCredentialsPort,
} from '../../bots/application/turn-credentials.port';
import { MODEL_PROVIDER_CREDENTIAL_REPOSITORY, TURN_CREDENTIALS } from '../../bots/bots.di-tokens';
import type { ModelProviderCredentialRepositoryPort } from '../../bots/database/model-provider-credential.repository.port';
import type { ChatgptSpeechPort, VoiceClip } from '../infrastructure/speech-to-text.port';
import { CHATGPT_SPEECH } from '../voice.di-tokens';
import type { SpeechGrant, SpeechProvider } from './speech-provider.port';

/**
 * A workspace's ChatGPT sign-in (Settings → Model providers) as a speech
 * provider. The sign-in is the bots module's: it is read and refreshed
 * through `TURN_CREDENTIALS`, the way a bot's turn reads it, so voice keeps
 * no second copy of the tokens. The same sign-in is what the polish runs on.
 */
@Injectable()
export class ChatgptSpeechResolver implements SpeechProvider<TurnCredential> {
  readonly id = 'chatgpt' as const;

  constructor(
    @Inject(MODEL_PROVIDER_CREDENTIAL_REPOSITORY)
    private readonly providers: ModelProviderCredentialRepositoryPort,
    @Inject(TURN_CREDENTIALS) private readonly credentials: TurnCredentialsPort,
    @Inject(CHATGPT_SPEECH) private readonly gateway: ChatgptSpeechPort,
  ) {}

  async availableFor(organizationId: string): Promise<boolean> {
    return (await this.providers.findForRun(organizationId, 'chatgpt')).isSome();
  }

  async grantFor(organizationId: string, now: Date): Promise<SpeechGrant<TurnCredential>> {
    const access = await this.credentials.forTurn(organizationId, 'chatgpt', now);
    return { access, polishOn: { provider: 'chatgpt', credential: access } };
  }

  transcribe(clip: VoiceClip, { access }: SpeechGrant<TurnCredential>): Promise<string> {
    return this.gateway.transcribe(clip, {
      accessToken: access.apiKey,
      accountId: access.accountId,
    });
  }
}
