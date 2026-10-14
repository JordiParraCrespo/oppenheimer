import { Separator } from '@oppenheimer/design-system-web';
import { useWatch } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { useNewSessionDraft } from '../hooks/use-new-session-form';
import { NewSessionBranch } from './new-session-branch';
import { NewSessionFolder } from './new-session-folder';
import { NewSessionHost } from './new-session-host';
import { NewSessionProject } from './new-session-project';
import { NewSessionRepositories } from './new-session-repositories';
import { NewSessionWhere } from './new-session-where';

/**
 * The scope band's chips, in the order the place reads
 * (`product/versions/mvp/24-session-places.md` §5): Where first, then for a
 * new worktree Project, Host, Repository and Branch — the project first,
 * because picking one prefills the rest — and for a folder on the host Host,
 * Folder and Project, the project optional and Unassigned until picked.
 *
 * It reads only `where`, so a pick of anything else leaves it still; the
 * chips are keyed, so the project and host chips keep their state when the
 * place moves them.
 *
 * A fieldset rather than a div with `role="group"`: the chips are one
 * decision — where this session runs — and a screen reader announces the
 * group's label once for all of them.
 */
export function NewSessionScope() {
  const { t } = useTranslation();
  const { control } = useNewSessionDraft();
  const where = useWatch({ control, name: 'where' });

  const chips =
    where === 'folder'
      ? [
          <NewSessionHost key="host" />,
          <NewSessionFolder key="folder" />,
          <NewSessionProject key="project" />,
        ]
      : [
          <NewSessionProject key="project" />,
          <NewSessionHost key="host" />,
          <NewSessionRepositories key="repositories" />,
          <NewSessionBranch key="branch" />,
        ];

  return (
    <fieldset aria-label={t('sessions.new.title')} className="contents">
      <NewSessionWhere />
      <Separator orientation="vertical" className="mx-1 h-4 self-center" />
      {chips}
    </fieldset>
  );
}
