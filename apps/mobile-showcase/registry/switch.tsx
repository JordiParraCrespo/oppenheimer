import { Label } from '@oppenheimer/design-system-mobile/label';
import { Switch } from '@oppenheimer/design-system-mobile/switch';
import { Text } from '@oppenheimer/design-system-mobile/text';
import * as React from 'react';
import { ScrollView, View } from 'react-native';

export default function SwitchScreen() {
  const [airplane, setAirplane] = React.useState(false);
  const [wifi, setWifi] = React.useState(true);
  const [bluetooth, setBluetooth] = React.useState(false);

  return (
    <ScrollView contentContainerClassName="p-6 gap-6">
      <View className="gap-2">
        <Text className="text-lg font-semibold text-foreground">Basic</Text>
        <View className="gap-4">
          <View className="flex-row items-center justify-between">
            <Label nativeID="airplane" onPress={() => setAirplane((v) => !v)}>
              Airplane Mode
            </Label>
            <Switch checked={airplane} onCheckedChange={setAirplane} />
          </View>
          <View className="flex-row items-center justify-between">
            <Label nativeID="wifi" onPress={() => setWifi((v) => !v)}>
              Wi-Fi
            </Label>
            <Switch checked={wifi} onCheckedChange={setWifi} />
          </View>
          <View className="flex-row items-center justify-between">
            <Label nativeID="bluetooth" onPress={() => setBluetooth((v) => !v)}>
              Bluetooth
            </Label>
            <Switch checked={bluetooth} onCheckedChange={setBluetooth} />
          </View>
        </View>
      </View>

      <View className="gap-2">
        <Text className="text-lg font-semibold text-foreground">Disabled</Text>
        <View className="flex-row items-center justify-between">
          <Text className="text-sm text-muted-foreground">Disabled switch</Text>
          <Switch checked={false} onCheckedChange={() => {}} disabled />
        </View>
      </View>
    </ScrollView>
  );
}
