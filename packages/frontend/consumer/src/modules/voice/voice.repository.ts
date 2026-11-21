import { heyApiSdk } from '@oppenheimer/api-client';
import { callApi } from '@oppenheimer/frontend-core';
import {
  type VoiceProvider,
  type VoiceSettings,
  type VoiceSettingsDto,
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
 * Dictation: one recorded clip, as a WAV, to the API, which hears it on the
 * provider the workspace chose (or the first it has) and tidies what it heard
 * into writing; and the workspace's voice settings, which choose those.
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

  /** How the workspace hears and speaks, and what it can choose from now. */
  settings(): Promise<VoiceSettingsDto> {
    return callApi(VoiceErrors.SETTINGS_FAILED, async (api) => {
      const data = await api.body(heyApiSdk.findVoiceSettings());
      return {
        transcriptionProvider: data.transcriptionProvider,
        transcriptionModel: data.transcriptionModel,
        synthesisProvider: data.synthesisProvider,
        synthesisModel: data.synthesisModel,
        synthesisVoice: data.synthesisVoice,
        polishProvider: data.polishProvider,
        polishModel: data.polishModel,
        available: {
          transcription: data.available.transcription,
          synthesis: data.available.synthesis,
          polish: data.available.polish,
        },
      };
    });
  }

  /** Replaces the workspace's voice choices whole. */
  updateSettings(settings: VoiceSettings): Promise<void> {
    return callApi(VoiceErrors.SAVE_SETTINGS_FAILED, async (api) => {
      await api.result(heyApiSdk.updateVoiceSettings({ body: settings }));
    });
  }
}
