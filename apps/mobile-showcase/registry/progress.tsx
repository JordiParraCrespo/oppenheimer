import { Button } from '@oppenheimer/design-system-mobile/button';
import { Progress } from '@oppenheimer/design-system-mobile/progress';
import { Text } from '@oppenheimer/design-system-mobile/text';
import * as React from 'react';
import { ScrollView, View } from 'react-native';

export default function ProgressScreen() {
  const [value, setValue] = React.useState(30);

  return (
    <ScrollView contentContainerClassName="p-6 gap-6">
      <View className="gap-2">
        <Text className="text-lg font-semibold text-foreground">Interactive</Text>
        <Progress value={value} />
        <Text className="text-sm text-muted-foreground text-center">{value}%</Text>
        <View className="flex-row gap-3 justify-center">
          <Button variant="outline" size="sm" onPress={() => setValue((v) => Math.max(0, v - 10))}>
            <Text>− 10</Text>
          </Button>
          <Button
            variant="outline"
            size="sm"
            onPress={() => setValue((v) => Math.min(100, v + 10))}
          >
            <Text>+ 10</Text>
          </Button>
        </View>
      </View>

      <View className="gap-3">
        <Text className="text-lg font-semibold text-foreground">States</Text>
        <View className="gap-1">
          <Text className="text-sm text-muted-foreground">Empty</Text>
          <Progress value={0} />
        </View>
        <View className="gap-1">
          <Text className="text-sm text-muted-foreground">Half</Text>
          <Progress value={50} />
        </View>
        <View className="gap-1">
          <Text className="text-sm text-muted-foreground">Full</Text>
          <Progress value={100} />
        </View>
      </View>
    </ScrollView>
  );
}
