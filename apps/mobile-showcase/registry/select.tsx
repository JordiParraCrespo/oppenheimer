import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from '@oppenheimer/design-system-mobile/select';
import { Text } from '@oppenheimer/design-system-mobile/text';
import * as React from 'react';
import { ScrollView, View } from 'react-native';

export default function SelectScreen() {
  return (
    <ScrollView contentContainerClassName="p-6 gap-6">
      <View className="gap-2">
        <Text className="text-lg font-semibold text-foreground">Basic</Text>
        <Select>
          <SelectTrigger className="w-full">
            <SelectValue placeholder="Select a fruit" />
          </SelectTrigger>
          <SelectContent>
            <SelectGroup>
              <SelectLabel>Fruits</SelectLabel>
              <SelectItem value="apple" label="Apple">
                Apple
              </SelectItem>
              <SelectItem value="banana" label="Banana">
                Banana
              </SelectItem>
              <SelectItem value="blueberry" label="Blueberry">
                Blueberry
              </SelectItem>
              <SelectItem value="grapes" label="Grapes">
                Grapes
              </SelectItem>
              <SelectItem value="pineapple" label="Pineapple">
                Pineapple
              </SelectItem>
            </SelectGroup>
          </SelectContent>
        </Select>
      </View>

      <View className="gap-2">
        <Text className="text-lg font-semibold text-foreground">Small</Text>
        <Select>
          <SelectTrigger size="sm" className="w-full">
            <SelectValue placeholder="Select a timezone" />
          </SelectTrigger>
          <SelectContent>
            <SelectGroup>
              <SelectLabel>Timezones</SelectLabel>
              <SelectItem value="est" label="Eastern (EST)">
                Eastern (EST)
              </SelectItem>
              <SelectItem value="cst" label="Central (CST)">
                Central (CST)
              </SelectItem>
              <SelectItem value="pst" label="Pacific (PST)">
                Pacific (PST)
              </SelectItem>
            </SelectGroup>
          </SelectContent>
        </Select>
      </View>
    </ScrollView>
  );
}
