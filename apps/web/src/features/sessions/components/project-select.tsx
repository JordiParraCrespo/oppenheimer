import {
  ChipSelect,
  type ChipSelectOption,
  type ChipSelectTriggerVariant,
} from '@oppenheimer/design-system-web';
import { FolderKanban } from '@oppenheimer/design-system-web/icons';
import { useTranslation } from 'react-i18next';

/**
 * The project chip of New session: the body of work the session belongs to,
 * first in the composer's scope band because picking it prefills the rest
 * (`product/versions/mvp/12-projects-on-the-console.md`).
 *
 * Props in, choice out — the list is read by the section above. What this
 * file owns is the chip's copy and its foot row, **New project…**, which
 * opens the dialog the section holds: the chip only says "open it", and where
 * the project it makes lands — the draft — is the section's.
 */
export function ProjectSelect({
  projects,
  value,
  onValueChange,
  onNewProject,
  loading,
  disabled,
  variant,
}: {
  projects: ChipSelectOption[];
  value: string | null;
  onValueChange: (value: string) => void;
  onNewProject: () => void;
  loading?: boolean;
  disabled?: boolean;
  variant?: ChipSelectTriggerVariant;
}) {
  const { t } = useTranslation();

  return (
    <ChipSelect
      value={value ?? ''}
      onValueChange={onValueChange}
      options={projects}
      icon={<FolderKanban />}
      loading={loading}
      loadingText={t('sessions.new.project.loading')}
      disabled={disabled}
      variant={variant}
      aria-label={t('sessions.new.project.label')}
      placeholder={t('sessions.new.project.placeholder')}
      searchPlaceholder={t('sessions.new.project.search')}
      emptyText={t('sessions.new.project.empty')}
      action={{ label: t('sessions.new.project.add'), onSelect: onNewProject }}
    />
  );
}
