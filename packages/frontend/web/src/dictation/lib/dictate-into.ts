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
 * What a field hands dictation: `text` to add to its end, in place of
 * `replacing` when that is what dictation put there last (the words heard
 * live, which the recording's transcription then replaces).
 */
export type DictatedText = (text: string, replacing?: string) => void;

/**
 * `text` in place of the `replacing` dictation added to the end of `held`.
 * When the field no longer ends with it (the person edited the end while it
 * was being heard), nothing is taken out and `text` is added after, so
 * nothing they wrote is lost. An empty `text` takes the live words back out.
 */
export function replaceDictation(held: string, replacing: string, text: string): string {
  if (replacing && held.endsWith(replacing)) {
    const before = held.slice(0, held.length - replacing.length);
    return text ? appendDictation(before, text) : before.trimEnd();
  }
  return text ? appendDictation(held, text) : held;
}

/**
 * What is heard, added to the end of a draft kept in state (a `useState`
 * setter, or a store's setter that takes an update): the field as it is when
 * the text arrives, not as it was when the recording started.
 */
export function dictateInto(set: (update: (held: string) => string) => void): DictatedText {
  return (text, replacing = '') => set((held) => replaceDictation(held, replacing, text));
}

/**
 * What is heard, added to the end of a React Hook Form field, which it marks
 * dirty: the form keeps the field, its validation and its Save.
 */
export function dictateIntoField<T extends FieldValues>(
  form: { getValues: UseFormGetValues<T>; setValue: UseFormSetValue<T> },
  name: FieldPath<T>,
): DictatedText {
  return (text, replacing = '') =>
    form.setValue(
      name,
      replaceDictation(String(form.getValues(name) ?? ''), replacing, text) as PathValue<
        T,
        FieldPath<T>
      >,
      { shouldDirty: true },
    );
}
