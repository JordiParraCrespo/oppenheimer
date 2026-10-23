import { createContext, useContext, useEffect, useState } from 'react';
import { type UseFormReturn, useForm } from 'react-hook-form';
import { rememberedFolder } from '../lib/folder-memory';
import {
  type DraftSeed,
  type NewSessionDraft,
  openDraft,
  type ProjectFilled,
  REMEMBERED_FIELDS,
  rememberDraft,
} from '../lib/new-session-draft';

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

/**
 * The chips the landing project may still fill, decided as the draft opened:
 * the draft writes every change back to storage, so the memory cannot be read
 * again once the visit has started. Fixed for the form's life, like the form.
 */
export const NewSessionLandingContext = createContext<readonly ProjectFilled[]>([]);

/**
 * Create the draft's store, seeded from the last visit (and from the address,
 * when it names a place, a host or an agent) and remembering this one.
 */
export function useNewSessionForm(seed?: DraftSeed): {
  form: NewSessionDraftForm;
  fillable: readonly ProjectFilled[];
} {
  const [{ draft: defaultValues, fillable }] = useState(() => openDraft(seed));
  const form = useForm<NewSessionDraft>({ defaultValues });

  // `localStorage`: the remembered fields are written out as they change.
  // `subscribe` rather than `useWatch`, so remembering a pick does not
  // re-render the section that owns the form.
  const { subscribe, getValues, setValue } = form;
  useEffect(
    () =>
      subscribe({
        name: [...REMEMBERED_FIELDS],
        formState: { values: true },
        callback: ({ values }) => rememberDraft(values),
      }),
    [subscribe],
  );

  // The form store: a folder is a path on one machine, so a host pick takes
  // that host's last folder, or none. Only a change of host does: the host
  // chip writes the same id again when an address names it.
  useEffect(() => {
    let host = getValues('hostId');
    return subscribe({
      name: ['hostId'],
      formState: { values: true },
      callback: ({ values }) => {
        if (values.hostId === host) return;
        host = values.hostId ?? null;
        setValue('folder', host ? (rememberedFolder(host)?.path ?? null) : null);
      },
    });
  }, [subscribe, getValues, setValue]);

  return { form, fillable };
}

export function useNewSessionDraft(): NewSessionDraftForm {
  const form = useContext(NewSessionFormContext);
  if (!form) throw new Error('useNewSessionDraft must be used inside NewSessionForm.');
  return form;
}

/** The chips the landing project may still fill (`NewSessionLandingContext`). */
export function useLandingFillable(): readonly ProjectFilled[] {
  return useContext(NewSessionLandingContext);
}
