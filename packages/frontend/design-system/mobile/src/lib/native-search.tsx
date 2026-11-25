import { Search } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { View } from 'react-native';
import { Icon } from '../components/ui/icon';
import { Input } from '../components/ui/input';
import type { NativeSearchProps } from './native-search.types';

/**
 * On iOS, a text field with the system's clear button. Like Android's search
 * bar it holds its own text and reports the empty text when it mounts.
 */
export function NativeSearch({ onQueryChange, placeholder }: NativeSearchProps) {
  const [text, setText] = useState('');

  // biome-ignore lint/correctness/useExhaustiveDependencies: reports the mount only, as Android's bar does.
  useEffect(() => onQueryChange(''), []);

  return (
    <View className="h-11 flex-row items-center gap-2 rounded-md border border-border-default bg-card px-3">
      <Icon as={Search} size={16} className="text-ink-400" />
      <Input
        className="h-full flex-1 border-0 bg-transparent px-0"
        value={text}
        onChangeText={(next) => {
          setText(next);
          onQueryChange(next);
        }}
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
