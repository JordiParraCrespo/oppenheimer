import {
  type RepositoryOption,
  type RepositoryScope,
  RepositorySelect,
} from '@oppenheimer/design-system-web';
import { Folder } from '@oppenheimer/design-system-web/icons';
import { useTranslation } from 'react-i18next';

/**
 * The repository chip, which multi-selects, and the branch pane that hangs off
 * each selected row.
 *
 * A session may span several repositories, one worktree each
 * (`product/versions/mvp/05-screens.md`), so a branch is a fact about a
 * repository rather than about the session — which is why the two are one
 * control: picking a repository lands it on its default branch, and its row
 * then grows the cell that opens its own branch pane.
 *
 * While the installations' repositories are still being read the chip is
 * `loading` rather than `disabled`: an empty list is a list that has not
 * arrived, and a greyed chip says the opposite.
 *
 * Every row carries the branches the section has loaded for it. Until that read
 * lands the picker falls back to the repository's `defaultBranch`, which is the
 * branch it would have chosen anyway.
 */
export function RepositoryBranchSelect({
  repositories,
  value,
  onValueChange,
  onConnect,
  loading,
  disabled,
}: {
  repositories: RepositoryOption[];
  value: RepositoryScope[];
  onValueChange: (value: RepositoryScope[]) => void;
  onConnect: () => void;
  loading?: boolean;
  disabled?: boolean;
}) {
  const { t } = useTranslation();

  return (
    <RepositorySelect
      repositories={repositories}
      value={value}
      onValueChange={onValueChange}
      icon={<Folder />}
      loading={loading}
      loadingText={t('sessions.new.repository.loading')}
      disabled={disabled}
      aria-label={t('sessions.new.repository.label')}
      placeholder={t('sessions.new.repository.placeholder')}
      searchPlaceholder={t('sessions.new.repository.search')}
      emptyText={t('sessions.new.repository.empty')}
      branchSearchPlaceholder={t('sessions.new.repository.branchSearch')}
      branchEmptyText={t('sessions.new.repository.branchEmpty')}
      branchPaneTitle={(name) => t('sessions.new.repository.branchPane', { name })}
      changeBranchLabel={t('sessions.new.repository.changeBranch')}
      action={{ label: t('sessions.new.repository.connect'), onSelect: onConnect }}
    />
  );
}
