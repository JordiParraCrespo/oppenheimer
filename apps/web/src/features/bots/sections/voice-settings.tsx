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
import {
  MODEL_PROVIDER_CATALOG,
  type ModelProvider,
} from '@oppenheimer/shared/schemas/model-provider';
import { POLISH_OFF, type VoiceSettings } from '@oppenheimer/shared/schemas/voice';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { SynthesisVoiceDialog } from '../dialogs/synthesis-voice';
import {
  AUTOMATIC,
  settingsOf,
  shownModel,
  synthesisModels,
  synthesisVoices,
  voiceRows,
} from '../lib/voice-settings';

/** A select's value for "a voice of the account's own", which opens the voice id dialog. */
const OWN_VOICE = '__own_voice__';

/**
 * Settings → Model providers, Voice: how the workspace hears and speaks, one
 * row each (`voiceRows`): Speech to text (dictation, and the voice notes bots
 * are sent), Voice notes (what bots reply in) and Transcript polish (the model
 * that tidies what was heard, or none). Every row picks a provider among those
 * the workspace can use now, or Automatic, the first it has, then that
 * provider's model; the voice-notes row alone adds the voice: one of OpenAI's
 * that the model speaks, or an ElevenLabs voice by id, a cloned one included.
 * A choice is saved as it is picked. Read under Suspense, in the screen's
 * `QueryState`.
 */
export function VoiceSettingsSection() {
  const { t } = useTranslation();
  const { data } = useSuspenseVoiceSettings();
  const update = useUpdateVoiceSettings();
  const [ownVoiceOpen, setOwnVoiceOpen] = useState(false);
  const settings = settingsOf(data);
  const save = (next: VoiceSettings) => update.mutate(next);

  const providerLabel = (provider: string) =>
    provider === 'speech_key'
      ? t('settings.modelProviders.voice.server')
      : MODEL_PROVIDER_CATALOG[provider as ModelProvider].label;
  const selectText = {
    searchPlaceholder: t('settings.modelProviders.voice.search'),
    emptyText: (query: string) => t('settings.modelProviders.voice.noMatch', { query }),
    disabled: update.isPending,
  };

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
        {voiceRows(data).map((row) => (
          <SettingsListRow
            key={row.id}
            align="center"
            data-testid={`voice-${row.id}`}
            meta={t(`settings.modelProviders.voice.${row.id}.meta`)}
            actions={
              <>
                <FieldSelect
                  variant="quiet"
                  aria-label={t(`settings.modelProviders.voice.${row.id}.providerLabel`)}
                  value={row.provider}
                  options={[
                    { value: AUTOMATIC, label: t('settings.modelProviders.voice.automatic') },
                    ...row.choices.map(({ value, available }) => ({
                      value,
                      label: available
                        ? providerLabel(value)
                        : t('settings.modelProviders.voice.notConnected', {
                            provider: providerLabel(value),
                          }),
                    })),
                    ...(row.off
                      ? [
                          {
                            value: POLISH_OFF,
                            label: t('settings.modelProviders.voice.polish.off'),
                          },
                        ]
                      : []),
                  ]}
                  placeholder={t('settings.modelProviders.voice.automatic')}
                  onValueChange={(value) => save(row.withProvider(settings, value))}
                  {...selectText}
                />
                {row.models.length > 1 ? (
                  <FieldSelect
                    variant="quiet"
                    aria-label={t(`settings.modelProviders.voice.${row.id}.modelLabel`)}
                    value={row.model}
                    options={row.models.map((model) => ({ value: model.id, label: model.label }))}
                    placeholder={t(`settings.modelProviders.voice.${row.id}.modelLabel`)}
                    onValueChange={(model) => save(row.withModel(settings, model))}
                    {...selectText}
                  />
                ) : null}
                {row.id === 'synthesis' && voiceOptions.length > 0 ? (
                  <FieldSelect
                    variant="quiet"
                    aria-label={t('settings.modelProviders.voice.synthesis.voiceLabel')}
                    value={shownVoice}
                    options={voiceOptions}
                    placeholder={t('settings.modelProviders.voice.synthesis.voiceLabel')}
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
            {t(`settings.modelProviders.voice.${row.id}.title`)}
          </SettingsListRow>
        ))}
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
