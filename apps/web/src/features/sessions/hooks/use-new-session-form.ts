import { createContext, useContext, useEffect, useState } from 'react';
import { type UseFormReturn, useForm } from 'react-hook-form';
import { initialDraft, type NewSessionDraft, rememberDraft } from '../lib/new-session-draft';

/**
 * The New session draft as one React Hook Form store. The section never reads
 * its values during render; each chip takes its own field with `useController`
 * / `useWatch`, so a pick re-renders only the chips reading that field.
 *
 * The context carries the form object, whose identity is stable for the
 * form's life, so the provider never re-renders a consumer. That is why it is
 * its own context rather than `FormProvider`, which spreads the methods into a
 * new object on every render of the section.
 */
export type NewSessionDraftForm = UseFormReturn<NewSessionDraft>;

export const NewSessionFormContext = createContext<NewSessionDraftForm | null>(null);

/** Create the draft's store, seeded from the last visit and remembering this one. */
export function useNewSessionForm(): NewSessionDraftForm {
  const [defaultValues] = useState(initialDraft);
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

export function useNewSessionDraft(): NewSessionDraftForm {
  const form = useContext(NewSessionFormContext);
  if (!form) throw new Error('useNewSessionDraft must be used inside NewSessionForm.');
  return form;
}
