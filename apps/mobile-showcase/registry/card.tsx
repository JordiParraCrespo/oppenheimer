import { Button } from '@oppenheimer/design-system-mobile/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@oppenheimer/design-system-mobile/card';
import { Text } from '@oppenheimer/design-system-mobile/text';
import * as React from 'react';
import { ScrollView, View } from 'react-native';

export default function CardScreen() {
  return (
    <ScrollView contentContainerClassName="p-6 gap-6">
      <View className="gap-2">
        <Text className="text-lg font-semibold text-foreground">Basic</Text>
        <Card>
          <CardHeader>
            <CardTitle>Card Title</CardTitle>
            <CardDescription>Card Description</CardDescription>
          </CardHeader>
          <CardContent>
            <Text className="text-sm text-foreground">Card content goes here.</Text>
          </CardContent>
          <CardFooter>
            <Button size="sm">
              <Text>Action</Text>
            </Button>
          </CardFooter>
        </Card>
      </View>

      <View className="gap-2">
        <Text className="text-lg font-semibold text-foreground">Notification</Text>
        <Card>
          <CardHeader>
            <CardTitle>Notifications</CardTitle>
            <CardDescription>You have 3 unread messages.</CardDescription>
          </CardHeader>
          <CardContent className="gap-3">
            {[
              'Your call has been confirmed.',
              'You have a new message!',
              'Your subscription is expiring.',
            ].map((msg) => (
              <View key={msg} className="flex-row items-center gap-3">
                <View className="size-2 rounded-full bg-primary" />
                <Text className="text-sm text-foreground flex-1">{msg}</Text>
              </View>
            ))}
          </CardContent>
          <CardFooter>
            <Button variant="outline" className="w-full">
              <Text>Mark all as read</Text>
            </Button>
          </CardFooter>
        </Card>
      </View>
    </ScrollView>
  );
}
