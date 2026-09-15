import { Button } from '@oppenheimer/design-system-mobile/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@oppenheimer/design-system-mobile/card';
import { Input } from '@oppenheimer/design-system-mobile/input';
import { Label } from '@oppenheimer/design-system-mobile/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@oppenheimer/design-system-mobile/tabs';
import { Text } from '@oppenheimer/design-system-mobile/text';
import * as React from 'react';
import { ScrollView, View } from 'react-native';

export default function TabsScreen() {
  const [tab, setTab] = React.useState('account');

  return (
    <ScrollView contentContainerClassName="p-6 gap-6">
      <View className="gap-2">
        <Text className="text-lg font-semibold text-foreground">Basic</Text>
        <Tabs value={tab} onValueChange={setTab}>
          <TabsList>
            <TabsTrigger value="account">
              <Text>Account</Text>
            </TabsTrigger>
            <TabsTrigger value="password">
              <Text>Password</Text>
            </TabsTrigger>
          </TabsList>
          <TabsContent value="account">
            <Card>
              <CardHeader>
                <CardTitle>Account</CardTitle>
                <CardDescription>Make changes to your account here.</CardDescription>
              </CardHeader>
              <CardContent className="gap-3">
                <View className="gap-2">
                  <Label nativeID="tab-name">Name</Label>
                  <Input defaultValue="Pedro Duarte" aria-labelledby="tab-name" />
                </View>
                <View className="gap-2">
                  <Label nativeID="tab-username">Username</Label>
                  <Input defaultValue="@peduarte" aria-labelledby="tab-username" />
                </View>
              </CardContent>
              <CardFooter>
                <Button>
                  <Text>Save changes</Text>
                </Button>
              </CardFooter>
            </Card>
          </TabsContent>
          <TabsContent value="password">
            <Card>
              <CardHeader>
                <CardTitle>Password</CardTitle>
                <CardDescription>Change your password here.</CardDescription>
              </CardHeader>
              <CardContent className="gap-3">
                <View className="gap-2">
                  <Label nativeID="tab-current">Current password</Label>
                  <Input secureTextEntry aria-labelledby="tab-current" />
                </View>
                <View className="gap-2">
                  <Label nativeID="tab-new">New password</Label>
                  <Input secureTextEntry aria-labelledby="tab-new" />
                </View>
              </CardContent>
              <CardFooter>
                <Button>
                  <Text>Save password</Text>
                </Button>
              </CardFooter>
            </Card>
          </TabsContent>
        </Tabs>
      </View>
    </ScrollView>
  );
}
