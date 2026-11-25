import { NativeSearch } from '../../lib/native-search';
import type { NativeSearchProps } from '../../lib/native-search.types';

export type SearchFieldProps = NativeSearchProps;

/**
 * The search over a list, narrowing it as you type: Material 3's search bar on
 * Android, a field with the system's clear button on iOS. On Android the bar
 * keeps its own text, so render it once per screen, outside anything that
 * swaps between loading, failed and ready.
 */
export function SearchField(props: SearchFieldProps) {
  return <NativeSearch {...props} />;
}
