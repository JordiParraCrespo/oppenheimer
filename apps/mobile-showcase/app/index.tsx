import { Button } from '@oppenheimer/design-system-mobile/button';
import { Text } from '@oppenheimer/design-system-mobile/text';
import { Link } from 'expo-router';
import * as React from 'react';
import { ScrollView, View } from 'react-native';
import { COMPONENTS } from '../lib/constants';

export default function HomeScreen() {
  return (
    <ScrollView contentContainerClassName="p-6 gap-3">
      <Text className="text-3xl font-bold text-foreground">Showcase</Text>
      <Text className="text-base text-muted-foreground mb-2">
        Browse all design system components.
      </Text>
      {COMPONENTS.map(({ slug, name }) => (
        <Link key={slug} href={`/components/${slug}`} asChild>
          <Button variant="outline" size="lg" className="w-full">
            <Text>{name}</Text>
          </Button>
        </Link>
      ))}
    </ScrollView>
  );
}
