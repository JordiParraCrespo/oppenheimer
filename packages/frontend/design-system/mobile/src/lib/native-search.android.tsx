import { DockedSearchBar, Icon, Text } from '@expo/ui/jetpack-compose';
import { fillMaxWidth } from '@expo/ui/jetpack-compose/modifiers';
import { NativeHost } from './native-scheme';
import type { NativeSearchProps } from './native-search.types';

const SEARCH_ICON = require('../../assets/search.xml');

/**
 * Material 3's docked search bar. It holds its own text and reports each
 * keystroke; its first report, as it mounts, is the empty text.
 */
export function NativeSearch({ onQueryChange, placeholder }: NativeSearchProps) {
  return (
    <NativeHost fillWidth>
      <DockedSearchBar onQueryChange={onQueryChange} modifiers={[fillMaxWidth()]}>
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
