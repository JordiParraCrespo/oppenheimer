import * as PopoverPrimitive from '@rn-primitives/popover';
import { Check, Filter } from 'lucide-react-native';
import * as React from 'react';
import { Platform, Pressable, StyleSheet, View } from 'react-native';
import { FadeIn, FadeOut } from 'react-native-reanimated';
import { FullWindowOverlay as RNFullWindowOverlay } from 'react-native-screens';
import { cn } from '../../lib/utils';
import { Icon } from './icon';
import { NativeOnlyAnimatedView } from './native-only-animated-view';
import { Text, TextClassContext } from './text';

type FilterMenuOption = {
  value: string;
  label: string;
  /** Rendered between the checkbox and the label — the facet's own icon. */
  icon?: React.ReactNode;
  /** How many rows this facet would leave. Omit rather than pass a guess. */
  count?: number;
};

const FullWindowOverlay = Platform.OS === 'ios' ? RNFullWindowOverlay : React.Fragment;

/**
 * FilterMenu — the toolbar's facet filter: a pill trigger that turns blue and
 * carries a count once anything is on, opening a menu of checkable facets with
 * the size of each on the right. Additive — the facets narrow together — so
 * the trigger can only report how many are on.
 *
 * The checkbox is drawn inline rather than reaching for `Checkbox`: every row
 * is itself a pressable, and a real checkbox inside one would be a control
 * inside a control.
 *
 * Controlled: own `selected` and handle `onSelectedChange`.
 */
function FilterMenu({
  options,
  selected,
  onSelectedChange,
  label = 'Filter',
  clearLabel = 'Clear filters',
  align = 'end',
  width = 236,
  className,
  portalHost,
}: {
  options: FilterMenuOption[];
  selected: string[];
  onSelectedChange: (selected: string[]) => void;
  label?: string;
  clearLabel?: string;
  align?: 'start' | 'center' | 'end';
  width?: number;
  className?: string;
  portalHost?: string;
}) {
  const active = selected.length;

  function toggle(value: string) {
    onSelectedChange(
      selected.includes(value)
        ? selected.filter((entry) => entry !== value)
        : [...selected, value],
    );
  }

  return (
    <PopoverPrimitive.Root>
      <PopoverPrimitive.Trigger
        className={cn(
          'h-9 shrink-0 flex-row items-center gap-[7px] rounded-full border border-border-default bg-card px-3 active:bg-surface-hover',
          active > 0 && 'border-accent-blue bg-focus-ring',
          className,
        )}
      >
        <Icon as={Filter} size={14} className={active ? 'text-accent-blue' : 'text-ink-600'} />
        <Text className="text-sm font-medium text-ink-900">{label}</Text>
        {active > 0 ? (
          <View className="h-[18px] min-w-[18px] shrink-0 items-center justify-center rounded-full bg-accent-blue px-1.5">
            <Text className="text-[11px] font-medium text-white">{active}</Text>
          </View>
        ) : null}
      </PopoverPrimitive.Trigger>

      <PopoverPrimitive.Portal hostName={portalHost}>
        <FullWindowOverlay>
          <PopoverPrimitive.Overlay style={Platform.select({ native: StyleSheet.absoluteFill })}>
            <NativeOnlyAnimatedView entering={FadeIn.duration(200)} exiting={FadeOut}>
              <TextClassContext.Provider value="text-popover-foreground">
                <PopoverPrimitive.Content
                  align={align}
                  sideOffset={4}
                  style={{ width }}
                  className="z-50 overflow-hidden rounded-2xl border border-border bg-popover p-1.5 shadow-md shadow-black/5"
                >
                  {options.map((option) => {
                    const on = selected.includes(option.value);
                    return (
                      <Pressable
                        key={option.value}
                        role="checkbox"
                        aria-checked={on}
                        onPress={() => toggle(option.value)}
                        className="w-full flex-row items-center gap-2.5 rounded-md px-2.5 py-2 active:bg-surface-hover"
                      >
                        <FilterMenuCheck checked={on} />
                        {option.icon ? (
                          <TextClassContext.Provider value="text-ink-400">
                            {option.icon}
                          </TextClassContext.Provider>
                        ) : null}
                        <Text numberOfLines={1} className="min-w-0 flex-1 text-base text-ink-900">
                          {option.label}
                        </Text>
                        {option.count === undefined ? null : (
                          <Text className="shrink-0 text-xs text-ink-400">{option.count}</Text>
                        )}
                      </Pressable>
                    );
                  })}
                  <View className="mx-0.5 my-[5px] h-px bg-border-subtle" />
                  <Pressable
                    disabled={active === 0}
                    onPress={() => onSelectedChange([])}
                    className="w-full flex-row items-center gap-2.5 rounded-md px-2.5 py-2 active:bg-surface-hover"
                  >
                    <View className="w-[17px] shrink-0" />
                    <Text
                      className={cn(
                        'min-w-0 flex-1 text-base',
                        active === 0 ? 'text-ink-400' : 'text-accent-blue',
                      )}
                    >
                      {clearLabel}
                    </Text>
                  </Pressable>
                </PopoverPrimitive.Content>
              </TextClassContext.Provider>
            </NativeOnlyAnimatedView>
          </PopoverPrimitive.Overlay>
        </FullWindowOverlay>
      </PopoverPrimitive.Portal>
    </PopoverPrimitive.Root>
  );
}

/**
 * Internal — the square check the rows draw. It is a drawing, not a control;
 * anything that needs a real checkbox should use `Checkbox`.
 */
function FilterMenuCheck({ checked }: { checked: boolean }) {
  return (
    <View
      aria-hidden
      className={cn(
        'size-[17px] shrink-0 items-center justify-center rounded-[5px] border-[1.5px]',
        checked ? 'border-accent-blue bg-accent-blue' : 'border-border-strong bg-transparent',
      )}
    >
      {checked ? <Icon as={Check} size={11} strokeWidth={3} className="text-white" /> : null}
    </View>
  );
}

export { FilterMenu, type FilterMenuOption };
