import { Button } from '@oppenheimer/design-system-mobile/button';
import { Text } from '@oppenheimer/design-system-mobile/text';
import * as React from 'react';
import { Alert, ScrollView, StyleSheet, View } from 'react-native';

const VARIANTS = [
  { label: 'Default', variant: 'default' as const, tone: 'light' as const },
  {
    label: 'Destructive',
    variant: 'destructive' as const,
    tone: 'light' as const,
  },
  { label: 'Outline', variant: 'outline' as const, tone: 'dark' as const },
  { label: 'Secondary', variant: 'secondary' as const, tone: 'dark' as const },
  { label: 'Ghost', variant: 'ghost' as const, tone: 'dark' as const },
  { label: 'Link', variant: 'link' as const, tone: 'link' as const },
];

const SIZES = [
  { label: 'Small', size: 'sm' as const },
  { label: 'Default', size: 'default' as const },
  { label: 'Large', size: 'lg' as const },
  { label: 'Icon', size: 'icon' as const },
];

export default function ButtonsScreen() {
  return (
    <ScrollView contentContainerStyle={styles.container}>
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Variants</Text>
        <View style={styles.stack}>
          {VARIANTS.map(({ label, variant, tone }) => (
            <Button
              key={variant}
              variant={variant}
              size="lg"
              className="w-full"
              onPress={() => Alert.alert('Button', label)}
            >
              <Text className={labelToneClassName[tone]}>{label}</Text>
            </Button>
          ))}
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Sizes</Text>
        <View style={styles.stack}>
          {SIZES.map(({ label, size }) => (
            <Button
              key={size}
              size={size}
              variant="default"
              onPress={() => Alert.alert('Button', label)}
            >
              <Text>{size === 'icon' ? '◎' : label}</Text>
            </Button>
          ))}
        </View>
      </View>
    </ScrollView>
  );
}

const labelToneClassName = {
  light: 'text-base font-semibold',
  dark: 'text-base font-semibold',
  link: 'text-base font-semibold underline',
} as const;

const styles = StyleSheet.create({
  container: {
    padding: 24,
    gap: 28,
  },
  section: {
    gap: 16,
  },
  sectionTitle: {
    color: '#111827',
    fontSize: 22,
    fontWeight: '700',
  },
  stack: {
    gap: 14,
    alignItems: 'flex-start',
  },
});
