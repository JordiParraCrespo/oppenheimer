import { heyApiSdk } from '@oppenheimer/api-client';
import { callApi } from '@oppenheimer/frontend-core';
import {
  type VoiceProvider,
  type VoiceStatusDto,
  vocabularyTerms,
} from '@oppenheimer/shared/schemas/voice';
import { injectable } from 'inversify';
import { VoiceErrors } from './voice.errors';

/** What a dictation says: the text for the field, and what the speech model heard. */
export interface VoiceTranscription {
  text: string;
  raw: string;
  provider: VoiceProvider;
  polished: boolean;
}

/**
 * Dictation (`product/next-steps/voice.md`): one recorded clip, as a WAV,
 * to the API, which hears it on the workspace's ChatGPT sign-in or the
 * deployment's own speech server and tidies what it heard into writing.
 */
@injectable()
export class VoiceRepository {
  /**
   * `vocabulary` is the names the screen already shows (projects,
   * repositories, hosts), which the tidy spells as written; it is cut to the
   * API's limits here, the same way the API reads it.
   */
  transcribe(
    audio: Blob,
    options: { vocabulary?: readonly string[]; language?: string } = {},
  ): Promise<VoiceTranscription> {
    return callApi(VoiceErrors.TRANSCRIBE_FAILED, async (api) => {
      const vocabulary = vocabularyTerms(options.vocabulary ?? []);
      const data = await api.body(
        heyApiSdk.transcribeVoice({
          body: {
            audio,
            vocabulary: vocabulary.length ? vocabulary.join('\n') : undefined,
            language: options.language,
          },
        }),
      );
      return { text: data.text, raw: data.raw, provider: data.provider, polished: data.polished };
    });
  }

  /**
   * Whether the workspace can dictate, and on which providers: the API asks
   * every speech provider it knows, so the console never decides it itself.
   */
  status(): Promise<VoiceStatusDto> {
    return callApi(VoiceErrors.STATUS_FAILED, async (api) => {
      const data = await api.body(heyApiSdk.findVoiceStatus());
      return { available: data.available, providers: data.providers };
    });
  }
}
