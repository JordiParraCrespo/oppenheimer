import { ChipSelect, type ChipSelectOption } from '@oppenheimer/design-system-web';
import { Folder } from '@oppenheimer/design-system-web/icons';
import { useTranslation } from 'react-i18next';

/**
 * The project chip of New session: which project the session is listed under.
 *
 * Every session names one, so the chip leads the row and send waits for it.
 * Its foot action opens New project — a workspace with none yet starts there.
 * Props in, choice out; the section above fetches.
 */
export function ProjectSelect({
  projects,
  value,
  onValueChange,
  onNewProject,
  loading,
}: {
  projects: ChipSelectOption[];
  value: string | null;
  onValueChange: (value: string) => void;
  onNewProject: () => void;
  loading?: boolean;
}) {
  const { t } = useTranslation();

  return (
    <ChipSelect
      value={value ?? ''}
      onValueChange={onValueChange}
      options={projects}
      icon={<Folder />}
      loading={loading}
      loadingText={t('sessions.new.project.loading')}
      aria-label={t('sessions.new.project.label')}
      placeholder={t('sessions.new.project.placeholder')}
      searchPlaceholder={t('sessions.new.project.search')}
      emptyText={t('sessions.new.project.empty')}
      action={{ label: t('sessions.new.project.add'), onSelect: onNewProject }}
    />
  );
}
