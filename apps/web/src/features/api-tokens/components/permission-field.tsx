import { Field, FieldError, FieldLabel } from '@oppenheimer/design-system-web';
import type { ReactNode } from 'react';
import { type Control, type FieldPath, type FieldValues, useWatch } from 'react-hook-form';
import { hasAnyScope, type ScopeSelection } from '@/features/api-tokens/lib/scope-selection';

/**
 * The label, the hint and the validation message around the permission picker.
 *
 * It exists so that nothing which *renders the rows* is subscribed to the
 * object the rows write. A `Controller` here was: it takes the whole
 * `permissions` value, so every click on a toggle — which writes
 * `permissions.<resource>` — re-rendered the wrapper and the picker inside it,
 * undoing the per-row fields entirely.
 *
 * This component does subscribe to the value, and that is fine: the picker
 * arrives as `children`, so it is an element the *form* created. Re-rendering
 * this wrapper reuses it untouched. What re-renders here is a label, a hint and
 * a line of text.
 *
 * `message` is the form's, not React Hook Form's. The cross-row rule ("a token
 * with no scopes can call nothing") cannot live on the field: the rows register
 * `permissions.<resource>` beneath it, and validation descends past the parent
 * path without ever running a rule set on it. So the form decides on submit,
 * and this hides the message again the moment the value stops being empty —
 * derived, so there is nothing to clear and no effect to write.
 */
export function PermissionField<TFieldValues extends FieldValues>({
  control,
  name,
  label,
  hint,
  message,
  children,
}: {
  control: Control<TFieldValues>;
  name: FieldPath<TFieldValues>;
  label: string;
  hint: string;
  /** Set by the form when a submit was refused; ignored once something is granted. */
  message?: string;
  children: ReactNode;
}) {
  const value = useWatch({ control, name }) as ScopeSelection | undefined;
  const shown = message && !hasAnyScope(value ?? {}) ? message : undefined;

  return (
    <Field data-invalid={Boolean(shown)}>
      <FieldLabel>{label}</FieldLabel>
      {children}
      <p className="text-xs text-ink-600">{hint}</p>
      <FieldError errors={[shown ? { message: shown } : undefined]} />
    </Field>
  );
}
