import { useRepositoryBranchesFor } from '@oppenheimer/frontend-consumer/react';
import { useController } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { BranchSelect } from '../components/branch-select';
import { useNewSessionDraft } from '../hooks/use-new-session-form';
import { parseRepositoryKey, toBranchOptions } from '../lib/session-options';

/**
 * The lone branch chip, bound to the draft's scope.
 *
 * It tells the truth only while exactly one repository is selected; with two
 * there are two base branches and one chip cannot say so, so it draws nothing.
 * Its branch read is the same query the repository picker already made for
 * that row, so it costs no second request.
 */
export function NewSessionBranch() {
  const { t } = useTranslation();
  const { control } = useNewSessionDraft();
  const { field } = useController({ control, name: 'scope' });

  const only = field.value.length === 1 ? field.value[0] : undefined;
  const ref = only ? parseRepositoryKey(only.id) : null;
  const branches = useRepositoryBranchesFor(ref ? [ref] : []);

  if (!only) return null;

  return (
    <BranchSelect
      branches={toBranchOptions(ref ? (branches.byRepository.get(ref.githubRepoId) ?? []) : [], {
        default: t('sessions.new.branch.default'),
      })}
      value={only.branch}
      onValueChange={(branch) => field.onChange([{ id: only.id, branch }])}
      loading={branches.isPending}
      variant="tab"
    />
  );
}
