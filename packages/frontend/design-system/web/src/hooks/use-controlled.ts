import { useCallback, useState } from 'react';

/**
 * State a component owns until its caller takes it over: the
 * `value` / `defaultValue` / `onChange` triple, written once.
 *
 * Every component that can be either controlled or uncontrolled otherwise
 * writes the same four lines — an internal `useState` seeded from the default,
 * `value ?? internal`, and a setter that writes the internal state only when
 * nobody passed `value` but always tells `onChange`. The copies drift: one
 * forgets to call `onChange` in uncontrolled mode, another resolves a
 * functional update against a stale value.
 *
 * `undefined` means uncontrolled; `null` is a value like any other, because a
 * picker with nothing picked is a real, controlled state. Whether the caller
 * controls it is read on every render, the way React's own inputs read it.
 *
 * ```tsx
 * function Disclosure({ open, defaultOpen = false, onOpenChange }: Props) {
 *   const [isOpen, setOpen] = useControlled({
 *     value: open,
 *     defaultValue: defaultOpen,
 *     onChange: onOpenChange,
 *   });
 *   return <button onClick={() => setOpen((current) => !current)}>…</button>;
 * }
 * ```
 *
 * `T` must not itself be a function: a function passed to the setter is read
 * as an updater, as it is by `useState`.
 */
export function useControlled<T>({
  value,
  defaultValue,
  onChange,
}: {
  /** The caller's value; `undefined` leaves the component in charge. */
  value: T | undefined;
  /** Where the component's own state starts while it is in charge. */
  defaultValue: T;
  /** Told about every change, controlled or not. */
  onChange?: (next: T) => void;
}): [T, (next: T | ((current: T) => T)) => void] {
  const [own, setOwn] = useState(defaultValue);
  const controlled = value !== undefined;
  const current = controlled ? value : own;

  // `useCallback` is the exception the rule allows in `hooks/`: the setter is
  // handed to children and to effects, and a new identity every render would
  // make each of them a re-render path for the component that owns it.
  const setValue = useCallback(
    (next: T | ((current: T) => T)) => {
      const resolved = typeof next === 'function' ? (next as (current: T) => T)(current) : next;
      if (!controlled) setOwn(resolved);
      onChange?.(resolved);
    },
    [controlled, current, onChange],
  );

  return [current, setValue];
}
