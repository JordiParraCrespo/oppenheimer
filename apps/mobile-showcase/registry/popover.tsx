import { Button } from '@oppenheimer/design-system-mobile/button';
import { Input } from '@oppenheimer/design-system-mobile/input';
import { Label } from '@oppenheimer/design-system-mobile/label';
import { Popover, PopoverContent, PopoverTrigger } from '@oppenheimer/design-system-mobile/popover';
import { Text } from '@oppenheimer/design-system-mobile/text';
import * as React from 'react';
import { ScrollView, View } from 'react-native';

export default function PopoverScreen() {
  return (
    <ScrollView contentContainerClassName="p-6 gap-6">
      <View className="gap-2">
        <Text className="text-lg font-semibold text-foreground">Basic</Text>
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline">
              <Text>Open Popover</Text>
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-80">
            <View className="gap-4">
              <View className="gap-1">
                <Text className="text-base font-medium text-foreground">Dimensions</Text>
                <Text className="text-sm text-muted-foreground">
                  Set the dimensions for the layer.
                </Text>
              </View>
              <View className="gap-3">
                <View className="gap-2">
                  <Label nativeID="width">Width</Label>
                  <Input defaultValue="100%" aria-labelledby="width" />
                </View>
                <View className="gap-2">
                  <Label nativeID="height">Height</Label>
                  <Input defaultValue="25px" aria-labelledby="height" />
                </View>
              </View>
            </View>
          </PopoverContent>
        </Popover>
      </View>
    </ScrollView>
  );
}
