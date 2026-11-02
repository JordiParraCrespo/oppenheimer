import { useWatch } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { useNewSessionDraft } from '../hooks/use-new-session-form';
import { NewSessionBranch } from './new-session-branch';
import { NewSessionFolder } from './new-session-folder';
import { NewSessionPlace } from './new-session-place';
import { NewSessionRepositories } from './new-session-repositories';

/**
 * Where the session runs, on the row under New session's box
 * (`NewSessionComposer.dc.html`), in the order the place reads
 * (`product/versions/mvp/24-session-places.md` §5): the host and where on it
 * first, as one chip, then for a new worktree Repository and Branch, for a
 * folder on the host Folder, and for the cloud Repository and Branch again:
 * the vendor's agent starts from that branch of that repository. Codex's
 * cloud environment is picked in the place chip, as the frame does. The project is not here: it sits over the box,
 * since picking one fills these in (`NewSessionForm`).
 *
 * It reads only `where`, so a pick of anything else leaves it still; the
 * place chip sits outside the swapped list, so it keeps its state when the
 * place changes under it.
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
      ? [<NewSessionFolder key="folder" />]
      : [<NewSessionRepositories key="repositories" />, <NewSessionBranch key="branch" />];

  return (
    <fieldset aria-label={t('sessions.new.title')} className="contents">
      <NewSessionPlace />
      {chips}
    </fieldset>
  );
}
