import { Search } from 'lucide-react-native';
import { View } from 'react-native';
import { Icon } from '../components/ui/icon';
import { Input } from '../components/ui/input';
import type { NativeSearchProps } from './native-search.types';

/** On iOS, a text field with the system's clear button. Metro picks `.android` there. */
export function NativeSearch({ value, onChangeText, placeholder }: NativeSearchProps) {
  return (
    <View className="h-11 flex-row items-center gap-2 rounded-md border border-border-default bg-card px-3">
      <Icon as={Search} size={16} className="text-ink-400" />
      <Input
        className="h-full flex-1 border-0 bg-transparent px-0"
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        accessibilityLabel={placeholder}
        autoCapitalize="none"
        autoCorrect={false}
        returnKeyType="search"
        clearButtonMode="while-editing"
      />
    </View>
  );
}
