import {
  FieldSelect,
  SettingsGroup,
  SettingsHeading,
  SettingsListRow,
} from '@oppenheimer/design-system-web';
import {
  useSuspenseVoiceSettings,
  useUpdateVoiceSettings,
} from '@oppenheimer/frontend-consumer/react';
import { ErrorAlert } from '@oppenheimer/frontend-web';
import { MODEL_PROVIDER_CATALOG } from '@oppenheimer/shared/schemas/model-provider';
import {
  POLISH_OFF,
  type PolishChoice,
  type SynthesisProvider,
  type VoiceModel,
  type VoiceProvider,
  type VoiceSettings,
} from '@oppenheimer/shared/schemas/voice';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { SynthesisVoiceDialog } from '../dialogs/synthesis-voice';
import {
  AUTOMATIC,
  botProviderLabel,
  type ProviderChoice,
  polishModels,
  providerChoices,
  providerOf,
  settingsOf,
  shownModel,
  synthesisModels,
  synthesisVoices,
  transcriptionModels,
  withPolishProvider,
  withSynthesisModel,
  withSynthesisProvider,
  withTranscriptionProvider,
} from '../lib/voice-settings';

/** A select's value for "a voice of the account's own", which opens the voice id dialog. */
const OWN_VOICE = '__own_voice__';

/**
 * Settings → Model providers, Voice: how the workspace hears and speaks, one
 * row each. Speech to text (dictation, and the voice notes bots are sent),
 * Voice notes (what bots reply in, with the model and voice), Transcript
 * polish (the model that tidies what was heard, or none). Each row picks a
 * provider among those the workspace can use now, or Automatic, the first it
 * has; then that provider's model, and for voice notes its voice: one of
 * OpenAI's, or an ElevenLabs voice by id, a cloned one included. A choice is
 * saved as it is picked. Read under Suspense, in the screen's `QueryState`.
 */
export function VoiceSettingsSection() {
  const { t } = useTranslation();
  const { data } = useSuspenseVoiceSettings();
  const update = useUpdateVoiceSettings();
  const [ownVoiceOpen, setOwnVoiceOpen] = useState(false);
  const settings = settingsOf(data);
  const save = (next: VoiceSettings) => update.mutate(next);

  const voiceLabel = (provider: VoiceProvider | SynthesisProvider) =>
    provider === 'speech_key'
      ? t('settings.modelProviders.voice.server')
      : MODEL_PROVIDER_CATALOG[provider].label;
  const choiceOptions = <P extends string>(
    choices: ProviderChoice<P>[],
    label: (provider: P) => string,
  ) => [
    { value: AUTOMATIC, label: t('settings.modelProviders.voice.automatic') },
    ...choices.map(({ value, available }) => ({
      value,
      label: available
        ? label(value)
        : t('settings.modelProviders.voice.notConnected', { provider: label(value) }),
    })),
  ];
  const selectText = {
    searchPlaceholder: t('settings.modelProviders.voice.search'),
    emptyText: (query: string) => t('settings.modelProviders.voice.noMatch', { query }),
  };
  const modelSelect = (
    models: readonly VoiceModel[],
    chosen: string | null,
    label: string,
    onPick: (model: string) => void,
  ) =>
    models.length > 1 ? (
      <FieldSelect
        variant="quiet"
        aria-label={label}
        value={shownModel(models, chosen)}
        options={models.map((row) => ({ value: row.id, label: row.label }))}
        placeholder={label}
        disabled={update.isPending}
        onValueChange={onPick}
        {...selectText}
      />
    ) : null;

  const voices = synthesisVoices(
    settings.synthesisProvider,
    shownModel(synthesisModels(settings.synthesisProvider), settings.synthesisModel),
  );
  const shownVoice = settings.synthesisVoice ?? voices?.default ?? null;
  const voiceOptions = voices
    ? [
        ...voices.voices.map((row) => ({ value: row.id, label: row.label })),
        ...(shownVoice && !voices.voices.some((row) => row.id === shownVoice)
          ? [
              {
                value: shownVoice,
                label: t('settings.modelProviders.voice.synthesis.own', { id: shownVoice }),
              },
            ]
          : []),
        ...(voices.custom
          ? [{ value: OWN_VOICE, label: t('settings.modelProviders.voice.synthesis.ownVoice') }]
          : []),
      ]
    : [];

  return (
    <section aria-labelledby="model-providers-voice" className="flex flex-col gap-2.5">
      <SettingsHeading id="model-providers-voice">
        {t('settings.modelProviders.voice.title')}
      </SettingsHeading>
      <p className="-mt-1 mb-1 text-13 text-fg-subtle">
        {t('settings.modelProviders.voice.description')}
      </p>
      <ErrorAlert
        error={update.error}
        fallback={t('settings.modelProviders.voice.saveFailed')}
        onDismiss={() => update.reset()}
      />
      <SettingsGroup>
        <SettingsListRow
          align="center"
          data-testid="voice-transcription"
          meta={t('settings.modelProviders.voice.transcription.meta')}
          actions={
            <>
              <FieldSelect
                variant="quiet"
                aria-label={t('settings.modelProviders.voice.transcription.providerLabel')}
                value={settings.transcriptionProvider ?? AUTOMATIC}
                options={choiceOptions(
                  providerChoices(data.available.transcription, settings.transcriptionProvider),
                  voiceLabel,
                )}
                placeholder={t('settings.modelProviders.voice.automatic')}
                disabled={update.isPending}
                onValueChange={(value) =>
                  save(withTranscriptionProvider(settings, providerOf<VoiceProvider>(value)))
                }
                {...selectText}
              />
              {modelSelect(
                transcriptionModels(settings.transcriptionProvider),
                settings.transcriptionModel,
                t('settings.modelProviders.voice.transcription.modelLabel'),
                (model) => save({ ...settings, transcriptionModel: model }),
              )}
            </>
          }
        >
          {t('settings.modelProviders.voice.transcription.title')}
        </SettingsListRow>
        <SettingsListRow
          align="center"
          data-testid="voice-synthesis"
          meta={t('settings.modelProviders.voice.synthesis.meta')}
          actions={
            <>
              <FieldSelect
                variant="quiet"
                aria-label={t('settings.modelProviders.voice.synthesis.providerLabel')}
                value={settings.synthesisProvider ?? AUTOMATIC}
                options={choiceOptions(
                  providerChoices(data.available.synthesis, settings.synthesisProvider),
                  voiceLabel,
                )}
                placeholder={t('settings.modelProviders.voice.automatic')}
                disabled={update.isPending}
                onValueChange={(value) =>
                  save(withSynthesisProvider(settings, providerOf<SynthesisProvider>(value)))
                }
                {...selectText}
              />
              {modelSelect(
                synthesisModels(settings.synthesisProvider),
                settings.synthesisModel,
                t('settings.modelProviders.voice.synthesis.modelLabel'),
                (model) => save(withSynthesisModel(settings, model)),
              )}
              {voiceOptions.length > 0 ? (
                <FieldSelect
                  variant="quiet"
                  aria-label={t('settings.modelProviders.voice.synthesis.voiceLabel')}
                  value={shownVoice}
                  options={voiceOptions}
                  placeholder={t('settings.modelProviders.voice.synthesis.voiceLabel')}
                  disabled={update.isPending}
                  onValueChange={(value) =>
                    value === OWN_VOICE
                      ? setOwnVoiceOpen(true)
                      : save({ ...settings, synthesisVoice: value })
                  }
                  {...selectText}
                />
              ) : null}
            </>
          }
        >
          {t('settings.modelProviders.voice.synthesis.title')}
        </SettingsListRow>
        <SettingsListRow
          align="center"
          data-testid="voice-polish"
          meta={t('settings.modelProviders.voice.polish.meta')}
          actions={
            <>
              <FieldSelect
                variant="quiet"
                aria-label={t('settings.modelProviders.voice.polish.providerLabel')}
                value={settings.polishProvider ?? AUTOMATIC}
                options={[
                  ...choiceOptions(
                    providerChoices(
                      data.available.polish,
                      settings.polishProvider === POLISH_OFF ? null : settings.polishProvider,
                    ),
                    botProviderLabel,
                  ),
                  { value: POLISH_OFF, label: t('settings.modelProviders.voice.polish.off') },
                ]}
                placeholder={t('settings.modelProviders.voice.automatic')}
                disabled={update.isPending}
                onValueChange={(value) =>
                  save(withPolishProvider(settings, providerOf<PolishChoice>(value)))
                }
                {...selectText}
              />
              {modelSelect(
                polishModels(settings.polishProvider),
                settings.polishModel,
                t('settings.modelProviders.voice.polish.modelLabel'),
                (model) => save({ ...settings, polishModel: model }),
              )}
            </>
          }
        >
          {t('settings.modelProviders.voice.polish.title')}
        </SettingsListRow>
      </SettingsGroup>
      {ownVoiceOpen ? (
        <SynthesisVoiceDialog
          initial={settings.synthesisVoice}
          onClose={() => setOwnVoiceOpen(false)}
          onSave={(voice) =>
            update.mutate(
              { ...settings, synthesisVoice: voice },
              { onSuccess: () => setOwnVoiceOpen(false) },
            )
          }
          isPending={update.isPending}
          error={update.error}
        />
      ) : null}
    </section>
  );
}
