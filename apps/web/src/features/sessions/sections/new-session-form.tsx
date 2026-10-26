import { useSearch } from '@tanstack/react-router';
import type { ReactNode } from 'react';
import {
  NewSessionFormContext,
  NewSessionLandingContext,
  useNewSessionForm,
} from '../hooks/use-new-session-form';
import { NewSessionAgent } from './new-session-agent';
import { NewSessionPermission } from './new-session-permission';
import { NewSessionPrepare } from './new-session-prepare';
import { NewSessionProject } from './new-session-project';
import { NewSessionScope } from './new-session-scope';
import { NewSessionSend } from './new-session-send';

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
 * The layout is `NewSessionComposer.dc.html` (the 2026-10-26 export): the
 * heading, the project over the box (it fills the rest in, so it is picked
 * first), the box, and under it one row of choices — where it runs and what
 * it may touch on the left (`NewSessionScope`, then the permission level),
 * the agent and effort on the right. The address can seed the draft
 * (`new-session-search.ts`): it is read once, for the store's first values.
 */
export function NewSessionForm({ heading }: { heading?: ReactNode }) {
  const search = useSearch({ from: '/_authenticated/sessions/new' });
  const { form, fillable } = useNewSessionForm({
    where: search.where,
    hostId: search.host,
    agent: search.agent,
    path: search.path,
  });

  return (
    <NewSessionFormContext.Provider value={form}>
      <NewSessionLandingContext.Provider value={fillable}>
        <NewSessionPrepare />
        {heading}
        <div className="-mb-2 flex">
          <NewSessionProject />
        </div>
        <NewSessionSend
          // Pending is `loading`, settled-and-empty is the empty line plus the
          // chip's own foot action, and `disabled` is only for a chip this
          // screen forbids — which none of these are.
          scope={<NewSessionScope />}
          tools={<NewSessionPermission />}
          engine={<NewSessionAgent />}
        />
      </NewSessionLandingContext.Provider>
    </NewSessionFormContext.Provider>
  );
}
