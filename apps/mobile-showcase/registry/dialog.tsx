import { Button } from '@oppenheimer/design-system-mobile/button';
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@oppenheimer/design-system-mobile/dialog';
import { Input } from '@oppenheimer/design-system-mobile/input';
import { Label } from '@oppenheimer/design-system-mobile/label';
import { Text } from '@oppenheimer/design-system-mobile/text';
import * as React from 'react';
import { ScrollView, View } from 'react-native';

export default function DialogScreen() {
  return (
    <ScrollView contentContainerClassName="p-6 gap-6">
      <View className="gap-2">
        <Text className="text-lg font-semibold text-foreground">Basic</Text>
        <Dialog>
          <DialogTrigger asChild>
            <Button variant="outline">
              <Text>Edit Profile</Text>
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Edit profile</DialogTitle>
              <DialogDescription>
                Make changes to your profile here. Click save when you're done.
              </DialogDescription>
            </DialogHeader>
            <View className="gap-4 py-4">
              <View className="gap-2">
                <Label nativeID="name">Name</Label>
                <Input placeholder="Pedro Duarte" aria-labelledby="name" />
              </View>
              <View className="gap-2">
                <Label nativeID="username">Username</Label>
                <Input placeholder="@peduarte" aria-labelledby="username" />
              </View>
            </View>
            <DialogFooter>
              <DialogClose asChild>
                <Button>
                  <Text>Save changes</Text>
                </Button>
              </DialogClose>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </View>
    </ScrollView>
  );
}
