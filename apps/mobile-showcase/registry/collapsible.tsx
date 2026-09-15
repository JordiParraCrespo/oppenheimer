import { Button } from '@oppenheimer/design-system-mobile/button';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@oppenheimer/design-system-mobile/collapsible';
import { Text } from '@oppenheimer/design-system-mobile/text';
import * as React from 'react';
import { ScrollView, View } from 'react-native';

export default function CollapsibleScreen() {
  const [open, setOpen] = React.useState(false);

  return (
    <ScrollView contentContainerClassName="p-6 gap-6">
      <View className="gap-2">
        <Text className="text-lg font-semibold text-foreground">Basic</Text>
        <Collapsible open={open} onOpenChange={setOpen}>
          <View className="flex-row items-center justify-between gap-4">
            <Text className="text-sm font-semibold text-foreground">
              @peduarte starred 3 repositories
            </Text>
            <CollapsibleTrigger asChild>
              <Button variant="ghost" size="sm">
                <Text>{open ? '−' : '+'}</Text>
              </Button>
            </CollapsibleTrigger>
          </View>
          <View className="rounded-md border border-border px-4 py-3 mt-2">
            <Text className="text-sm text-foreground">@radix-ui/primitives</Text>
          </View>
          <CollapsibleContent>
            <View className="gap-2 mt-2">
              <View className="rounded-md border border-border px-4 py-3">
                <Text className="text-sm text-foreground">@radix-ui/colors</Text>
              </View>
              <View className="rounded-md border border-border px-4 py-3">
                <Text className="text-sm text-foreground">@stitches/react</Text>
              </View>
            </View>
          </CollapsibleContent>
        </Collapsible>
      </View>
    </ScrollView>
  );
}
