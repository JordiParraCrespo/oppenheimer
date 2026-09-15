import { Alert, AlertDescription, AlertTitle } from '@oppenheimer/design-system-mobile/alert';
import { Text } from '@oppenheimer/design-system-mobile/text';
import { AlertTriangle, Info, Terminal } from 'lucide-react-native';
import * as React from 'react';
import { ScrollView, View } from 'react-native';

export default function AlertScreen() {
  return (
    <ScrollView contentContainerClassName="p-6 gap-6">
      <View className="gap-2">
        <Text className="text-lg font-semibold text-foreground">Default</Text>
        <Alert icon={Terminal}>
          <AlertTitle>Heads up!</AlertTitle>
          <AlertDescription>You can add components to your app using the CLI.</AlertDescription>
        </Alert>
      </View>

      <View className="gap-2">
        <Text className="text-lg font-semibold text-foreground">Destructive</Text>
        <Alert icon={AlertTriangle} variant="destructive">
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>Your session has expired. Please log in again.</AlertDescription>
        </Alert>
      </View>

      <View className="gap-2">
        <Text className="text-lg font-semibold text-foreground">Info</Text>
        <Alert icon={Info}>
          <AlertTitle>Note</AlertTitle>
          <AlertDescription>
            This action cannot be undone. Please proceed with caution.
          </AlertDescription>
        </Alert>
      </View>
    </ScrollView>
  );
}
