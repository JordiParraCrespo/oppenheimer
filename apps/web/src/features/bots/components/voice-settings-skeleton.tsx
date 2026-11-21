import {
  SettingsGroup,
  SettingsHeading,
  SettingsListRow,
  Skeleton,
} from '@oppenheimer/design-system-web';
import { useTranslation } from 'react-i18next';

const ROWS = ['transcription', 'synthesis', 'polish'] as const;

/**
 * The Voice section before the workspace's choices answer: its three rows are
 * known, so their names and what each does are written, and only the selects
 * are bars.
 */
export function VoiceSettingsSkeleton() {
  const { t } = useTranslation();
  return (
    <section aria-busy className="flex flex-col gap-2.5">
      <SettingsHeading>{t('settings.modelProviders.voice.title')}</SettingsHeading>
      <p className="-mt-1 mb-1 text-13 text-fg-subtle">
        {t('settings.modelProviders.voice.description')}
      </p>
      <SettingsGroup>
        {ROWS.map((row) => (
          <SettingsListRow
            key={row}
            align="center"
            aria-hidden
            meta={t(`settings.modelProviders.voice.${row}.meta`)}
            actions={<Skeleton shape="pill" className="h-7 w-24" />}
          >
            {t(`settings.modelProviders.voice.${row}.title`)}
          </SettingsListRow>
        ))}
      </SettingsGroup>
    </section>
  );
}
