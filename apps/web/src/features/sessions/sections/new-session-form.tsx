import { useTranslation } from 'react-i18next';
import { NewSessionFormContext, useNewSessionForm } from '../hooks/use-new-session-form';
import { NewSessionAgent } from './new-session-agent';
import { NewSessionBranch } from './new-session-branch';
import { NewSessionEffort } from './new-session-effort';
import { NewSessionHost } from './new-session-host';
import { NewSessionPermission } from './new-session-permission';
import { NewSessionProject } from './new-session-project';
import { NewSessionRepositories } from './new-session-repositories';
import { NewSessionSend } from './new-session-send';

/**
 * New session: the draft's store, and where each of its controls sits.
 *
 * This section holds no field and reads none. The draft is a React Hook Form
 * store (`useNewSessionForm`) handed down through a context whose value never
 * changes, and each chip below is a section that binds one field of it and
 * fetches the list it draws. Three clocks, three owners:
 *
 * - a pick re-renders the chip that was picked, and any chip that reads the
 *   same field (the branch chip reads the repository chip's scope);
 * - a settle of a list re-renders the chip that draws it;
 * - a keystroke re-renders the composer's textarea, and nothing else.
 *
 * So this component renders once. The chips are created here and handed to
 * `NewSessionSend` as elements, which is what keeps them still when the send
 * gate or the request's state re-renders that section: an element React has
 * already seen, passed back unchanged, is not rendered again. The React
 * Compiler would give the same result for a component shaped worse; this shape
 * does not depend on it, and `new-session-form-render.spec.tsx` holds it there.
 *
 * The chips sit in the composer's `scope` slot, the grey band fused to the
 * top of the field (the 2026-09-26 export's tabbed composer): project first,
 * because picking one prefills the rest
 * (`product/versions/mvp/12-projects-on-the-console.md`); then the host, the
 * repository, and the branch while exactly one repository is selected.
 */
export function NewSessionForm() {
  const { t } = useTranslation();
  const form = useNewSessionForm();

  return (
    <NewSessionFormContext.Provider value={form}>
      <NewSessionSend
        scope={
          // A fieldset rather than a div with `role="group"`: the chips are
          // one decision — where this session runs — and a screen reader
          // announces the legend once for all of them. Pending is `loading`,
          // settled-and-empty is the empty line plus the chip's own foot
          // action, and `disabled` is only for a chip this screen forbids —
          // which none of these are.
          <fieldset aria-label={t('sessions.new.title')} className="contents">
            <NewSessionProject />
            <NewSessionHost />
            <NewSessionRepositories />
            <NewSessionBranch />
          </fieldset>
        }
        tools={<NewSessionPermission />}
        engine={
          <>
            <NewSessionAgent />
            <NewSessionEffort />
          </>
        }
      />
    </NewSessionFormContext.Provider>
  );
}
