import type {
  FieldPath,
  FieldValues,
  PathValue,
  UseFormGetValues,
  UseFormSetValue,
} from 'react-hook-form';

/** `text` added to the end of what a field holds, a space between them. */
export function appendDictation(held: string, text: string): string {
  return held.trim() ? `${held.trimEnd()} ${text}` : text;
}

/**
 * What is heard, added to the end of a draft kept in state (a `useState`
 * setter, or a store's setter that takes an update): the field as it is when
 * the text arrives, not as it was when the recording started.
 */
export function dictateInto(
  set: (update: (held: string) => string) => void,
): (text: string) => void {
  return (text) => set((held) => appendDictation(held, text));
}

/**
 * What is heard, added to the end of a React Hook Form field, which it marks
 * dirty: the form keeps the field, its validation and its Save.
 */
export function dictateIntoField<T extends FieldValues>(
  form: { getValues: UseFormGetValues<T>; setValue: UseFormSetValue<T> },
  name: FieldPath<T>,
): (text: string) => void {
  return (text) =>
    form.setValue(
      name,
      appendDictation(String(form.getValues(name) ?? ''), text) as PathValue<T, FieldPath<T>>,
      { shouldDirty: true },
    );
}
