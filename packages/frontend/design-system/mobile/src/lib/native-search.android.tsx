import { DockedSearchBar, Icon, Text } from '@expo/ui/jetpack-compose';
import { fillMaxWidth } from '@expo/ui/jetpack-compose/modifiers';
import { NativeHost } from './native-scheme';
import type { NativeSearchProps } from './native-search.types';

const SEARCH_ICON = require('../../assets/search.xml');

/**
 * Material 3's docked search bar, reporting each keystroke so the list under
 * it narrows as you type. It keeps its own text, so `value` is not read: keep
 * it mounted in one place for as long as the screen is.
 */
export function NativeSearch({ onChangeText, placeholder }: NativeSearchProps) {
  return (
    <NativeHost fillWidth>
      <DockedSearchBar onQueryChange={onChangeText} modifiers={[fillMaxWidth()]}>
        <DockedSearchBar.LeadingIcon>
          <Icon source={SEARCH_ICON} size={24} />
        </DockedSearchBar.LeadingIcon>
        <DockedSearchBar.Placeholder>
          <Text>{placeholder}</Text>
        </DockedSearchBar.Placeholder>
      </DockedSearchBar>
    </NativeHost>
  );
}
