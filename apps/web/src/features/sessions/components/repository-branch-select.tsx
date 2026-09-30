import {
  BrandGlyph,
  type ChipSelectTriggerVariant,
  type RepositoryOption,
  type RepositoryScope,
  RepositorySelect,
} from '@oppenheimer/design-system-web';
import { ArrowUpRight, Folder } from '@oppenheimer/design-system-web/icons';
import { useTranslation } from 'react-i18next';
import { capRepositories } from '../lib/session-options';

/**
 * The repository chip, and the branch pane off the selected row. A session
 * checks out one repository in the MVP (`capRepositories`,
 * `product/versions/mvp/00-scope.md`): the runner makes one worktree per
 * session, and a second repository accepted here was refused by the host,
 * leaving a session that spun forever (#56). So a second pick replaces the
 * first; the picker keeps its multi-select for when runners make several.
 *
 * A branch belongs to a repository, so the two are one control and a picked
 * repository lands on its default branch. `branchesLoading` is its own flag
 * because the API reads branches from GitHub live. Both flags mean loading,
 * not disabled: an empty list has not arrived, and a greyed chip says the
 * opposite.
 */
export function RepositoryBranchSelect({
  repositories,
  value,
  onValueChange,
  onManage,
  loading,
  failure,
  branchesLoading,
  disabled,
  variant,
}: {
  repositories: RepositoryOption[];
  value: RepositoryScope[];
  onValueChange: (value: RepositoryScope[]) => void;
  /**
   * Opens the App's install page to change what it covers; absent when the
   * deployment has no GitHub App, which drops the foot row.
   */
  onManage?: () => void;
  loading?: boolean;
  failure?: string;
  branchesLoading?: boolean;
  disabled?: boolean;
  variant?: ChipSelectTriggerVariant;
}) {
  const { t } = useTranslation();

  return (
    <RepositorySelect
      repositories={repositories}
      value={value}
      onValueChange={(next) => onValueChange(capRepositories(value, next))}
      icon={<Folder />}
      loading={loading}
      loadingText={t('sessions.new.repository.loading')}
      branchesLoading={branchesLoading}
      branchesLoadingText={t('sessions.new.branch.loading')}
      disabled={disabled}
      variant={variant}
      aria-label={t('sessions.new.repository.label')}
      placeholder={t('sessions.new.repository.placeholder')}
      searchPlaceholder={t('sessions.new.repository.search')}
      emptyText={
        failure ?? t(onManage ? 'sessions.new.repository.empty' : 'sessions.new.repository.noApp')
      }
      branchSearchPlaceholder={t('sessions.new.repository.branchSearch')}
      branchEmptyText={t('sessions.new.repository.branchEmpty')}
      branchPaneTitle={(name) => t('sessions.new.repository.branchPane', { name })}
      changeBranchLabel={t('sessions.new.repository.changeBranch')}
      action={
        onManage
          ? {
              label: t('sessions.new.repository.manage'),
              icon: <BrandGlyph name="github" size={15} />,
              trailing: <ArrowUpRight />,
              onSelect: onManage,
            }
          : undefined
      }
    />
  );
}
