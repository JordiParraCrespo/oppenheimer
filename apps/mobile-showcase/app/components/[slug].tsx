import { Text } from '@oppenheimer/design-system-mobile/text';
import { useLocalSearchParams, useNavigation } from 'expo-router';
import * as React from 'react';
import { View } from 'react-native';
import { COMPONENTS } from '../../lib/constants';
import { REGISTRY } from '../../registry';

export default function ComponentScreen() {
  const { slug } = useLocalSearchParams<{ slug: string }>();
  const navigation = useNavigation();

  const title = COMPONENTS.find((c) => c.slug === slug)?.name ?? slug ?? 'Component';

  React.useLayoutEffect(() => {
    navigation.setOptions({ headerTitle: title });
  }, [navigation, title]);

  const Demo = slug ? REGISTRY[slug] : undefined;

  if (!Demo) {
    return (
      <View className="flex-1 items-center justify-center p-6">
        <Text className="text-lg text-muted-foreground">No demo for "{slug}"</Text>
      </View>
    );
  }

  return <Demo />;
}
