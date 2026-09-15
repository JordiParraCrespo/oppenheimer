import { FilterMenu, type FilterMenuOption } from '@oppenheimer/design-system-mobile/filter-menu';
import { Icon } from '@oppenheimer/design-system-mobile/icon';
import { Globe, Mail, Users } from '@oppenheimer/design-system-mobile/icons';
import { Text } from '@oppenheimer/design-system-mobile/text';
import * as React from 'react';
import { ScrollView, View } from 'react-native';

const OPTIONS: FilterMenuOption[] = [
  { value: 'domains', label: 'Domains', icon: <Icon as={Globe} size={14} />, count: 12 },
  { value: 'people', label: 'People', icon: <Icon as={Users} size={14} />, count: 4 },
  { value: 'mail', label: 'Mail', icon: <Icon as={Mail} size={14} />, count: 31 },
];

export default function FilterMenuScreen() {
  const [selected, setSelected] = React.useState<string[]>(['domains']);

  return (
    <ScrollView contentContainerClassName="gap-6 p-6">
      <View className="gap-2">
        <Text className="text-lg font-semibold text-foreground">Toolbar</Text>
        <View className="flex-row items-center gap-2">
          <FilterMenu options={OPTIONS} selected={selected} onSelectedChange={setSelected} />
          <Text className="text-sm text-ink-400">
            {selected.length === 0 ? 'Showing everything' : `${selected.length} on`}
          </Text>
        </View>
      </View>
    </ScrollView>
  );
}
