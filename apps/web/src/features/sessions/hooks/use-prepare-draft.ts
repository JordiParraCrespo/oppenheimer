import { usePrepareSession } from '@oppenheimer/frontend-consumer/react';
import { useEffect } from 'react';
import type { NewSessionDraft } from '../lib/new-session-draft';
import { toCheckouts } from '../lib/session-options';
import type { NewSessionDraftForm } from './use-new-session-form';

/**
 * Asks the draft's host to get its repository ready the moment both are
 * picked — or as the screen opens, when a project's defaults fill them in:
 * the host clones or fetches it and makes a spare worktree while the prompt
 * is being written, so pressing send starts from a checkout that already
 * exists (`product/versions/mvp/02-runner.md` §5).
 *
 * Each host, repository and branch is asked for once per visit. It reads the
 * draft through `subscribe`, so no pick re-renders the form for it, and a
 * failure says nothing: the create does the same work itself.
 */
export function usePrepareDraft(form: NewSessionDraftForm): void {
  const { mutate } = usePrepareSession();
  const { subscribe, getValues } = form;

  useEffect(() => {
    const asked = new Set<string>();
    const prepare = (values: Partial<NewSessionDraft>) => {
      const [checkout] = toCheckouts(values.scope ?? []);
      if (!values.hostId || !checkout) return;
      const key = [
        values.hostId,
        checkout.installationId,
        checkout.githubRepoId,
        checkout.baseBranch ?? '',
      ].join(':');
      if (asked.has(key)) return;
      asked.add(key);
      mutate({ hostId: values.hostId, checkouts: [checkout] });
    };
    prepare(getValues());
    return subscribe({
      name: ['hostId', 'scope'],
      formState: { values: true },
      callback: ({ values }) => prepare(values),
    });
  }, [subscribe, getValues, mutate]);
}
