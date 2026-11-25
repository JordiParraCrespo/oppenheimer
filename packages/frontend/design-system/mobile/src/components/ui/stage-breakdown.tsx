import { ArrowDown, ArrowUp } from 'lucide-react-native';
import type * as React from 'react';
import { View } from 'react-native';
import { cn } from '../../lib/utils';
import { Icon } from './icon';
import { Separator } from './separator';
import { Text } from './text';

type StageBreakdownTone = 'active' | 'paused' | 'draft' | 'ended';

interface StageBreakdownItem {
  id: string;
  label: React.ReactNode;
  value: number;
  delta?: number | null;
  tone: StageBreakdownTone;
}

type StageBreakdownProps = React.ComponentProps<typeof View> & {
  items: StageBreakdownItem[];
  total?: number;
  formatValue?: (value: number) => React.ReactNode;
  formatPercentage?: (percentage: number) => React.ReactNode;
  formatDelta?: (delta: number) => React.ReactNode;
};

const toneClasses: Record<StageBreakdownTone, string> = {
  active: 'bg-status-active',
  paused: 'bg-status-paused',
  draft: 'bg-status-draft',
  ended: 'bg-status-ended',
};

function StageBreakdown({
  items,
  total: suppliedTotal,
  formatValue = String,
  formatPercentage = (percentage) => `${Math.round(percentage)}%`,
  formatDelta = (delta) => `${delta >= 0 ? '+' : ''}${delta}%`,
  className,
  ...props
}: StageBreakdownProps) {
  const itemsTotal = items.reduce((sum, item) => sum + item.value, 0);
  const total = Math.max(suppliedTotal ?? itemsTotal, itemsTotal);
  const remainder = total - itemsTotal;

  return (
    <View className={cn('min-w-0', className)} {...props}>
      <View
        className="mb-[22px] h-2 flex-row gap-[3px]"
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
      >
        {total > 0 ? (
          <>
            {items.map((item) => (
              <View
                key={item.id}
                className={cn('min-w-0 rounded-full', toneClasses[item.tone])}
                style={{ flexBasis: 0, flexGrow: item.value }}
              />
            ))}
            {remainder > 0 ? (
              <View
                className="min-w-0 rounded-full bg-data-track"
                style={{ flexBasis: 0, flexGrow: remainder }}
              />
            ) : null}
          </>
        ) : (
          <View className="flex-1 rounded-full bg-data-track" />
        )}
      </View>

      <View className="flex flex-col">
        {items.map((item, index) => {
          const percentage = total === 0 ? 0 : (item.value / total) * 100;
          const up = !(item.delta != null && item.delta < 0);
          const Caret = up ? ArrowUp : ArrowDown;

          return (
            <View key={item.id}>
              {index > 0 ? <Separator className="bg-border-subtle" /> : null}
              <View className="flex-row items-center gap-2.5 py-[11px]">
                <View
                  className={cn('size-[7px] shrink-0 rounded-full', toneClasses[item.tone])}
                  accessibilityElementsHidden
                  importantForAccessibility="no-hide-descendants"
                />
                <Text numberOfLines={1} className="min-w-0 flex-1 text-sm text-ink-900">
                  {item.label}
                </Text>
                {item.delta == null ? (
                  <Text className="shrink-0 text-sm text-ink-400">—</Text>
                ) : (
                  <View className="shrink-0 flex-row items-center gap-0.5">
                    <Icon
                      as={Caret}
                      size={12}
                      className={up ? 'text-data-up' : 'text-data-down'}
                      aria-hidden
                    />
                    <Text
                      className={cn(
                        'text-sm font-medium tabular-nums',
                        up ? 'text-data-up' : 'text-data-down',
                      )}
                    >
                      {formatDelta(item.delta)}
                    </Text>
                  </View>
                )}
                <Text className="min-w-9 shrink-0 text-right text-sm font-medium text-ink-900 tabular-nums">
                  {formatValue(item.value)}
                </Text>
                <Text className="min-w-[34px] shrink-0 text-right text-[13px] text-ink-400 tabular-nums">
                  {formatPercentage(percentage)}
                </Text>
              </View>
            </View>
          );
        })}
      </View>
    </View>
  );
}

export { StageBreakdown };
export type { StageBreakdownItem, StageBreakdownProps, StageBreakdownTone };
