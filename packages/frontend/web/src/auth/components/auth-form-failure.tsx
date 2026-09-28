import type { FieldValues, UseFormReturn } from 'react-hook-form';
import { type ResolvedErrorMessage, useServerFieldErrors } from '../../forms';
import { AuthFormError } from './auth-primitives';

/**
 * A sign-in screen's failed submission, where it belongs: the fields the
 * server refused are marked on the fields, and the banner above them shows
 * only when there is something left to say — no field named, or one this form
 * does not have. Every auth form mounts this rather than wiring the hook and
 * the banner itself.
 */
export function AuthFormFailure<TValues extends FieldValues>({
  form,
  error,
}: {
  form: Pick<UseFormReturn<TValues>, 'setError' | 'getValues'>;
  /** The resolved failure of the last submission, if it failed. */
  error?: ResolvedErrorMessage;
}) {
  const { showAlert } = useServerFieldErrors(form, error);
  return error && showAlert ? <AuthFormError>{error.message}</AuthFormError> : null;
}
