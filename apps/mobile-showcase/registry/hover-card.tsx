import { Button } from '@oppenheimer/design-system-mobile/button';
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from '@oppenheimer/design-system-mobile/hover-card';
import { Text } from '@oppenheimer/design-system-mobile/text';
import * as React from 'react';
import { ScrollView, View } from 'react-native';

export default function HoverCardScreen() {
  return (
    <ScrollView contentContainerClassName="p-6 gap-6">
      <View className="gap-2">
        <Text className="text-lg font-semibold text-foreground">Basic</Text>
        <Text className="text-sm text-muted-foreground">
          Press the trigger to show the hover card.
        </Text>
        <HoverCard>
          <HoverCardTrigger asChild>
            <Button variant="link">
              <Text>@nextjs</Text>
            </Button>
          </HoverCardTrigger>
          <HoverCardContent className="w-72">
            <View className="gap-2">
              <Text className="text-sm font-semibold text-foreground">Next.js</Text>
              <Text className="text-sm text-muted-foreground">
                The React Framework — created and maintained by @vercel.
              </Text>
              <Text className="text-xs text-muted-foreground">Joined December 2021</Text>
            </View>
          </HoverCardContent>
        </HoverCard>
      </View>
    </ScrollView>
  );
}
