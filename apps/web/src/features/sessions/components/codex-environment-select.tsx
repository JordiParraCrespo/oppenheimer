import {
  ChipSelect,
  type ChipSelectOption,
  type ChipSelectTriggerVariant,
} from '@oppenheimer/design-system-web';
import { Box } from '@oppenheimer/design-system-web/icons';
import { useTranslation } from 'react-i18next';

/**
 * The Codex environment chip of a Codex cloud session: which of the ChatGPT
 * account's environments the task starts in. Its first row, `''`, is the
 * host's own pick, the environment linked to the repository; the section above
 * builds the rows (`toCodexEnvironmentOptions`) and says how the read went.
 */
export function CodexEnvironmentSelect({
  options,
  value,
  onValueChange,
  loading,
  variant,
}: {
  options: ChipSelectOption[];
  value: string;
  onValueChange: (value: string) => void;
  loading?: boolean;
  variant?: ChipSelectTriggerVariant;
}) {
  const { t } = useTranslation();

  return (
    <ChipSelect
      value={value}
      onValueChange={onValueChange}
      options={options}
      icon={<Box />}
      loading={loading}
      loadingText={t('sessions.new.codexEnvironment.loading')}
      variant={variant}
      aria-label={t('sessions.new.codexEnvironment.label')}
      placeholder={t('sessions.new.codexEnvironment.placeholder')}
      searchPlaceholder={t('sessions.new.codexEnvironment.search')}
      emptyText={t('sessions.new.codexEnvironment.empty')}
    />
  );
}
