import { useHostsSnapshot, useProjectsSnapshot } from '@oppenheimer/frontend-consumer/react';
import { createContext, useContext, useEffect, useState } from 'react';
import { type UseFormReturn, useForm } from 'react-hook-form';
import { initialDraft, type NewSessionDraft, rememberDraft } from '../lib/new-session-draft';
import { projectPrefill } from '../lib/session-options';

/**
 * The New session draft, as one React Hook Form store the chips subscribe to
 * one field at a time.
 *
 * The draft used to be one `useState` object in the section, so picking an
 * effort re-rendered the section and, through it, every chip, the three reads
 * behind them and the composer. It is a form now: the values live in React
 * Hook Form's store rather than in React state, the section never reads them
 * during render, and each chip takes its own field off the store with
 * `useController` / `useWatch` — a pick re-renders that chip and whichever
 * other chip reads the same field, and nothing else.
 *
 * The context carries the form object, not its values, and that object keeps
 * one identity for the life of the form: a provider whose value never changes
 * never re-renders a consumer. That is why this is a context of its own rather
 * than React Hook Form's `FormProvider`, which spreads the methods into a new
 * object on every render of the section.
 */
export type NewSessionDraftForm = UseFormReturn<NewSessionDraft>;

export const NewSessionFormContext = createContext<NewSessionDraftForm | null>(null);

/**
 * Create the draft's store, seeded from the last visit and remembering this one.
 *
 * `projectId` is a project the URL names — the one New project just made — and
 * it wins over the remembered one, with its defaults applied as a pick would
 * apply them. It is read from the cache once, when the store is made: the
 * create put it there before navigating here.
 */
export function useNewSessionForm(projectId?: string): NewSessionDraftForm {
  const projects = useProjectsSnapshot();
  const hosts = useHostsSnapshot();
  // Read storage and the cache once, not on every render of the section.
  const [defaultValues] = useState(() => {
    const draft = initialDraft();
    const named = projectId ? projects()?.find((project) => project.id === projectId) : undefined;
    if (!named) return draft;
    const prefill = projectPrefill(
      named,
      (hosts() ?? []).map((host) => host.id),
    );
    return { ...draft, ...prefill, projectId: named.id };
  });
  const form = useForm<NewSessionDraft>({ defaultValues });

  // `localStorage`: the five remembered fields are written out as they change.
  // `subscribe` rather than `useWatch`, so remembering a pick does not
  // re-render the section that owns the form.
  const { subscribe } = form;
  useEffect(
    () =>
      subscribe({
        name: ['projectId', 'hostId', 'agent', 'model', 'effort'],
        formState: { values: true },
        callback: ({ values }) => rememberDraft(values),
      }),
    [subscribe],
  );

  return form;
}

/** The draft's store, from inside New session. */
export function useNewSessionDraft(): NewSessionDraftForm {
  const form = useContext(NewSessionFormContext);
  if (!form) throw new Error('useNewSessionDraft must be used inside NewSessionForm.');
  return form;
}
