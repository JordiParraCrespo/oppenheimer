import { Button } from '@oppenheimer/design-system-mobile/button';
import { Text } from '@oppenheimer/design-system-mobile/text';
import { Tooltip, TooltipContent, TooltipTrigger } from '@oppenheimer/design-system-mobile/tooltip';
import * as React from 'react';
import { ScrollView, View } from 'react-native';

export default function TooltipScreen() {
  return (
    <ScrollView contentContainerClassName="p-6 gap-6">
      <View className="gap-2">
        <Text className="text-lg font-semibold text-foreground">Basic</Text>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button variant="outline">
              <Text>Hover / Press me</Text>
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            <Text>Add to library</Text>
          </TooltipContent>
        </Tooltip>
      </View>

      <View className="gap-2">
        <Text className="text-lg font-semibold text-foreground">Side Variants</Text>
        <View className="gap-3 items-start">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="outline" size="sm">
                <Text>Top (default)</Text>
              </Button>
            </TooltipTrigger>
            <TooltipContent side="top">
              <Text>Tooltip on top</Text>
            </TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="outline" size="sm">
                <Text>Bottom</Text>
              </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom">
              <Text>Tooltip on bottom</Text>
            </TooltipContent>
          </Tooltip>
        </View>
      </View>
    </ScrollView>
  );
}
