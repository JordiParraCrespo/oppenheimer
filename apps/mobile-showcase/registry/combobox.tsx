import { Combobox, type ComboboxOption } from '@oppenheimer/design-system-mobile/combobox';
import { Label } from '@oppenheimer/design-system-mobile/label';
import { Text } from '@oppenheimer/design-system-mobile/text';
import * as React from 'react';
import { ScrollView, View } from 'react-native';

const TEAM: ComboboxOption[] = [
  { value: 'ana', label: 'Ana Costa', meta: 'ana@example.com' },
  { value: 'ben', label: 'Ben Okafor', meta: 'ben@example.com' },
  { value: 'chloe', label: 'Chloé Martin', meta: 'chloe@example.com' },
  { value: 'dan', label: 'Dan Reyes', meta: 'dan@example.com' },
  { value: 'eve', label: 'Eve Lindqvist', meta: 'eve@example.com' },
];

const DOMAINS: ComboboxOption[] = Array.from({ length: 200 }, (_, index) => ({
  value: `domain-${index}`,
  label: `site-${index + 1}.example.com`,
}));

export default function ComboboxScreen() {
  const [owner, setOwner] = React.useState<string | null>(null);
  const [domain, setDomain] = React.useState<string | null>('domain-3');

  return (
    <ScrollView contentContainerClassName="gap-6 p-6">
      <View className="gap-2">
        <Text className="text-lg font-semibold text-foreground">With a clear row</Text>
        <Label>Owner</Label>
        <Combobox
          options={TEAM}
          value={owner}
          onValueChange={setOwner}
          clearLabel="Unassigned"
          searchPlaceholder="Search teammates…"
        />
      </View>

      <View className="gap-2">
        <Text className="text-lg font-semibold text-foreground">Windowed list</Text>
        <Label>Domain</Label>
        <Combobox
          options={DOMAINS}
          value={domain}
          onValueChange={setDomain}
          placeholder="Pick a domain"
          searchPlaceholder="Search domains…"
        />
      </View>
    </ScrollView>
  );
}
