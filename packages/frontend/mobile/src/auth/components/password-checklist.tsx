import {
  checkPassword,
  meetsPasswordRequirements,
  type PasswordRule,
} from '@oppenheimer/frontend-core';
import type { ReactNode } from 'react';
import { type Control, type FieldPathByValue, type FieldValues, useWatch } from 'react-hook-form';
import { PasswordRequirements } from './password-requirements';

/**
 * The live password checklist, subscribed at the leaf.
 *
 * It watches the password field (and the confirmation, when the screen has
 * one) itself, so every keystroke re-renders this checklist and whatever the
 * render prop returns — the submit button it gates — and not the whole form.
 *
 * Web keeps its copy of this in `apps/web`; on mobile both Expo apps ask for
 * it (register here, reset-password in the control plane too), so it lives in
 * the kit instead of being written twice.
 */
export function PasswordChecklist<
  TValues extends FieldValues,
  TName extends FieldPathByValue<TValues, string>,
>({
  control,
  name,
  confirmName,
  rules,
  className,
  children,
}: {
  control: Control<TValues>;
  name: TName;
  /** The confirm field, on screens whose rules include `match`. */
  confirmName?: FieldPathByValue<TValues, string>;
  rules: readonly PasswordRule[];
  className?: string;
  /** Receives whether every rule is met; renders the control it gates. */
  children: (satisfied: boolean) => ReactNode;
}) {
  const password = useWatch({ control, name });
  const confirmPassword = useWatch({
    control,
    name: confirmName ?? name,
    disabled: confirmName == null,
  });
  const results = checkPassword(password ?? '', confirmName ? confirmPassword : undefined);

  return (
    <>
      <PasswordRequirements results={results} rules={rules} className={className} />
      {children(meetsPasswordRequirements(results, rules))}
    </>
  );
}
