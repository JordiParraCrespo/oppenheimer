import type { ReactNode } from 'react';
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
import { NewSessionSubtitle } from './new-session-subtitle';

/**
 * New session: the draft's store and where each control sits. This section
 * holds and reads no field: the draft (`useNewSessionForm`) goes down a
 * context whose value never changes, and each chip binds one field and
 * fetches its own list. So a pick re-renders the chips reading that field, a
 * list settle the chip drawing it, a keystroke only the textarea, and this
 * renders once. The chips go to `NewSessionSend` as elements so its re-renders
 * leave them still; the shape does not lean on the React Compiler, and
 * `new-session-form-render.spec.tsx` holds it.
 *
 * The chips sit in the composer's `scope` band (the 2026-09-26 export):
 * project first, because picking one prefills the rest
 * (`product/versions/mvp/05-screens.md`), then host, repository, and the
 * branch while exactly one repository is selected.
 */
export function NewSessionForm({ heading }: { heading?: ReactNode }) {
  const { t } = useTranslation();
  const form = useNewSessionForm();

  return (
    <NewSessionFormContext.Provider value={form}>
      {heading ? (
        <div>
          {heading}
          <NewSessionSubtitle />
        </div>
      ) : null}
      <NewSessionSend
        scope={
          // A fieldset rather than a div with `role="group"`: the chips are
          // one decision — where this session runs — and a screen reader
          // announces the group's label once for all of them. Pending is `loading`,
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
