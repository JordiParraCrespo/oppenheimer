import { Text } from '@oppenheimer/design-system-mobile/text';
import * as React from 'react';
import { ScrollView, View } from 'react-native';

export default function TextScreen() {
  return (
    <ScrollView contentContainerClassName="p-6 gap-6">
      <View className="gap-4">
        <Text className="text-lg font-semibold text-foreground">Variants</Text>
        <Text variant="h1">Heading 1</Text>
        <Text variant="h2">Heading 2</Text>
        <Text variant="h3">Heading 3</Text>
        <Text variant="h4">Heading 4</Text>
        <Text variant="p">
          This is a paragraph. The quick brown fox jumps over the lazy dog. It demonstrates the
          default paragraph styling with proper line height.
        </Text>
        <Text variant="lead">A lead paragraph used for introductory text.</Text>
        <Text variant="large">Large text</Text>
        <Text variant="small">Small text</Text>
        <Text variant="muted">Muted text for secondary content</Text>
        <Text variant="blockquote">This is a blockquote with left border styling.</Text>
        <Text variant="code">const hello = "world";</Text>
      </View>
    </ScrollView>
  );
}
