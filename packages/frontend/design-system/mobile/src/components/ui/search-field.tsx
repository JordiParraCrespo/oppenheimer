import { NativeSearch } from '../../lib/native-search';
import type { NativeSearchProps } from '../../lib/native-search.types';

export type SearchFieldProps = NativeSearchProps;

/**
 * The search over a list, narrowing it as you type: Material 3's search bar on
 * Android, a field with the system's clear button on iOS. The field owns its
 * text and the list follows it: `onQueryChange` hears every change, and `''`
 * whenever the field mounts, so a field that is remounted empty also clears
 * the list's filter. There is no `value` to set.
 */
export function SearchField(props: SearchFieldProps) {
  return <NativeSearch {...props} />;
}
