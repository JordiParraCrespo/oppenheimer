import {
  BrandGlyph,
  type RepositoryOption,
  type RepositoryScope,
  RepositorySelect,
} from '@oppenheimer/design-system-web';
import { Folder } from '@oppenheimer/design-system-web/icons';
import { useTranslation } from 'react-i18next';
import { capRepositories } from '../lib/session-options';

/**
 * The repository chip, and the branch pane that hangs off the selected row.
 *
 * A session checks out one repository in the MVP (`capRepositories`,
 * `product/versions/mvp/00-scope.md`): a runner makes one worktree per
 * session, and a second repository used to be accepted here and then refused
 * by the host, leaving a session that spun forever (#56). So picking a second
 * repository replaces the first rather than adding to it; the design system's
 * picker keeps its multi-select for the day runners make several.
 *
 * A branch is a fact about a repository rather than about the session — which
 * is why the two are one control: picking a repository lands it on its default
 * branch, and its row then grows the cell that opens its own branch pane.
 *
 * Two reads, so two flags: `loading` is the repositories, `branchesLoading` the
 * branches of the ones already picked — a slower read, because the API asks
 * GitHub live, and the pane that shows it is inside this same popup. Both are
 * `loading` rather than `disabled`: an empty list is a list that has not
 * arrived, and a greyed chip says the opposite.
 *
 * Every row carries the branches the section has loaded for it. Until that read
 * lands the picker falls back to the repository's `defaultBranch`, which is the
 * branch it would have chosen anyway.
 *
 * The foot row leaves the console. Which repositories the App can see is
 * decided on GitHub's own installation page and nowhere here, so "Manage
 * repository access" is a link to it, in a new tab, with the GitHub mark. The
 * address is the deployment's (`github_app_install_url`); without it there is
 * no row, rather than a link to a page that may not exist.
 */
export function RepositoryBranchSelect({
  repositories,
  value,
  onValueChange,
  manageUrl,
  loading,
  branchesLoading,
  disabled,
}: {
  repositories: RepositoryOption[];
  value: RepositoryScope[];
  onValueChange: (value: RepositoryScope[]) => void;
  /** The GitHub App's installation page, as the deployment reports it. */
  manageUrl?: string;
  loading?: boolean;
  branchesLoading?: boolean;
  disabled?: boolean;
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
      aria-label={t('sessions.new.repository.label')}
      placeholder={t('sessions.new.repository.placeholder')}
      searchPlaceholder={t('sessions.new.repository.search')}
      emptyText={t('sessions.new.repository.empty')}
      branchSearchPlaceholder={t('sessions.new.repository.branchSearch')}
      branchEmptyText={t('sessions.new.repository.branchEmpty')}
      branchPaneTitle={(name) => t('sessions.new.repository.branchPane', { name })}
      changeBranchLabel={t('sessions.new.repository.changeBranch')}
      action={
        manageUrl
          ? {
              label: t('sessions.new.repository.manage'),
              icon: <BrandGlyph name="github" size={15} />,
              href: manageUrl,
            }
          : undefined
      }
    />
  );
}
