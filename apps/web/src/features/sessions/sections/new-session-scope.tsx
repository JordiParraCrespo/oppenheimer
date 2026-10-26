import { useWatch } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { useNewSessionDraft } from '../hooks/use-new-session-form';
import { NewSessionBranch } from './new-session-branch';
import { NewSessionFolder } from './new-session-folder';
import { NewSessionHost } from './new-session-host';
import { NewSessionRepositories } from './new-session-repositories';
import { NewSessionWhere } from './new-session-where';

/**
 * Where the session runs, on the row under New session's box
 * (`NewSessionComposer.dc.html`), in the order the place reads
 * (`product/versions/mvp/24-session-places.md` §5): Where first, then for a
 * new worktree Host, Repository and Branch, and for a folder on the host Host
 * and Folder. The project is not here: it sits over the box, since picking
 * one fills these in (`NewSessionForm`).
 *
 * It reads only `where`, so a pick of anything else leaves it still; the
 * chips are keyed, so the host chip keeps its state when the place moves it.
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
      ? [<NewSessionHost key="host" />, <NewSessionFolder key="folder" />]
      : [
          <NewSessionHost key="host" />,
          <NewSessionRepositories key="repositories" />,
          <NewSessionBranch key="branch" />,
        ];

  return (
    <fieldset aria-label={t('sessions.new.title')} className="contents">
      <NewSessionWhere />
      {chips}
    </fieldset>
  );
}
