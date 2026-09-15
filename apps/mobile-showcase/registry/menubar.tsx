import {
  Menubar,
  MenubarContent,
  MenubarItem,
  MenubarMenu,
  MenubarSeparator,
  MenubarTrigger,
} from '@oppenheimer/design-system-mobile/menubar';
import { Text } from '@oppenheimer/design-system-mobile/text';
import * as React from 'react';
import { ScrollView, View } from 'react-native';

export default function MenubarScreen() {
  return (
    <ScrollView contentContainerClassName="p-6 gap-6">
      <View className="gap-2">
        <Text className="text-lg font-semibold text-foreground">Basic</Text>
        <Menubar>
          <MenubarMenu value="file">
            <MenubarTrigger>
              <Text>File</Text>
            </MenubarTrigger>
            <MenubarContent>
              <MenubarItem>
                <Text>New Tab</Text>
              </MenubarItem>
              <MenubarItem>
                <Text>New Window</Text>
              </MenubarItem>
              <MenubarSeparator />
              <MenubarItem>
                <Text>Share</Text>
              </MenubarItem>
              <MenubarSeparator />
              <MenubarItem>
                <Text>Print</Text>
              </MenubarItem>
            </MenubarContent>
          </MenubarMenu>
          <MenubarMenu value="edit">
            <MenubarTrigger>
              <Text>Edit</Text>
            </MenubarTrigger>
            <MenubarContent>
              <MenubarItem>
                <Text>Undo</Text>
              </MenubarItem>
              <MenubarItem>
                <Text>Redo</Text>
              </MenubarItem>
              <MenubarSeparator />
              <MenubarItem>
                <Text>Cut</Text>
              </MenubarItem>
              <MenubarItem>
                <Text>Copy</Text>
              </MenubarItem>
              <MenubarItem>
                <Text>Paste</Text>
              </MenubarItem>
            </MenubarContent>
          </MenubarMenu>
          <MenubarMenu value="view">
            <MenubarTrigger>
              <Text>View</Text>
            </MenubarTrigger>
            <MenubarContent>
              <MenubarItem>
                <Text>Zoom In</Text>
              </MenubarItem>
              <MenubarItem>
                <Text>Zoom Out</Text>
              </MenubarItem>
              <MenubarSeparator />
              <MenubarItem>
                <Text>Full Screen</Text>
              </MenubarItem>
            </MenubarContent>
          </MenubarMenu>
        </Menubar>
      </View>
    </ScrollView>
  );
}
