import { heyApiSdk } from '@oppenheimer/api-client';
import { MapApiError, unwrapBody } from '@oppenheimer/frontend-core';
import { type VoiceProvider, vocabularyTerms } from '@oppenheimer/shared/schemas/voice';
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
  @MapApiError(VoiceErrors.TRANSCRIBE_FAILED)
  async transcribe(
    audio: Blob,
    options: { vocabulary?: readonly string[]; language?: string } = {},
  ): Promise<VoiceTranscription> {
    const vocabulary = vocabularyTerms(options.vocabulary ?? []);
    const data = await unwrapBody(
      heyApiSdk.transcribeVoice({
        body: {
          audio,
          vocabulary: vocabulary.length ? vocabulary.join('\n') : undefined,
          language: options.language,
        },
      }),
      VoiceErrors.TRANSCRIBE_FAILED,
    );
    return { text: data.text, raw: data.raw, provider: data.provider, polished: data.polished };
  }
}
