import {
  checkPassword,
  meetsRequirements,
  PasswordRequirements,
  type PasswordRule,
} from '@oppenheimer/frontend-web';
import type { ReactNode } from 'react';
import { type Control, type FieldValues, type Path, useWatch } from 'react-hook-form';

/**
 * The live password checklist, subscribed at the leaf.
 *
 * It watches the password field (and the confirmation, when the screen has
 * one) itself, so every keystroke re-renders this checklist and whatever the
 * render prop returns — the submit button it gates — and not the whole form.
 */
export function PasswordChecklist<TValues extends FieldValues>({
  control,
  name,
  confirmName,
  rules,
  className,
  children,
}: {
  control: Control<TValues>;
  name: Path<TValues>;
  /** The confirm field, on screens whose rules include `match`. */
  confirmName?: Path<TValues>;
  rules: readonly PasswordRule[];
  className?: string;
  /** Receives whether every rule is met; renders the control it gates. */
  children: (satisfied: boolean) => ReactNode;
}) {
  const watched = useWatch({
    control,
    name: (confirmName ? [name, confirmName] : [name]) as Path<TValues>[],
  }) as unknown as (string | undefined)[];

  const [password, confirmPassword] = watched;
  const results = confirmName
    ? checkPassword(password ?? '', confirmPassword ?? '')
    : checkPassword(password ?? '');
  const satisfied = meetsRequirements(results, rules);

  return (
    <>
      <PasswordRequirements results={results} rules={rules} className={className} />
      {children(satisfied)}
    </>
  );
}
