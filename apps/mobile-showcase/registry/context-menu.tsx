import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuGroup,
  ContextMenuItem,
  ContextMenuLabel,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from '@oppenheimer/design-system-mobile/context-menu';
import { Text } from '@oppenheimer/design-system-mobile/text';
import * as React from 'react';
import { ScrollView, View } from 'react-native';

export default function ContextMenuScreen() {
  return (
    <ScrollView contentContainerClassName="p-6 gap-6">
      <View className="gap-2">
        <Text className="text-lg font-semibold text-foreground">Basic</Text>
        <Text className="text-sm text-muted-foreground">
          Long press the area below to open the context menu.
        </Text>
        <ContextMenu>
          <ContextMenuTrigger>
            <View className="items-center justify-center rounded-lg border-2 border-dashed border-border py-16">
              <Text className="text-sm text-muted-foreground">Long press here</Text>
            </View>
          </ContextMenuTrigger>
          <ContextMenuContent className="w-64">
            <ContextMenuLabel>
              <Text>Actions</Text>
            </ContextMenuLabel>
            <ContextMenuSeparator />
            <ContextMenuGroup>
              <ContextMenuItem>
                <Text>Copy</Text>
              </ContextMenuItem>
              <ContextMenuItem>
                <Text>Paste</Text>
              </ContextMenuItem>
              <ContextMenuItem>
                <Text>Cut</Text>
              </ContextMenuItem>
            </ContextMenuGroup>
            <ContextMenuSeparator />
            <ContextMenuItem variant="destructive">
              <Text>Delete</Text>
            </ContextMenuItem>
          </ContextMenuContent>
        </ContextMenu>
      </View>
    </ScrollView>
  );
}
