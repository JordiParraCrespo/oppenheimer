import { Icon } from '@oppenheimer/design-system-mobile/icon';
import { Check } from '@oppenheimer/design-system-mobile/icons';
import { Text } from '@oppenheimer/design-system-mobile/text';
import { cn } from '@oppenheimer/design-system-mobile/utils';
import type { PasswordRule } from '@oppenheimer/frontend-core';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';

export type { PasswordRule } from '@oppenheimer/frontend-core';

/**
 * The live checklist under a password field. Rules read tertiary until they
 * pass, then fill green and take primary ink — the only place colour carries
 * meaning on these screens.
 */
export function PasswordRequirements({
  results,
  rules,
  className,
}: {
  results: Record<PasswordRule, boolean>;
  rules: readonly PasswordRule[];
  className?: string;
}) {
  const { t } = useTranslation();

  return (
    <View className={cn('gap-[7px]', className)}>
      {rules.map((rule) => {
        const passed = results[rule];

        return (
          <View key={rule} className="flex-row items-center gap-2">
            <View
              className={cn(
                'size-4 items-center justify-center rounded-full border-[1.5px]',
                passed ? 'border-status-active bg-status-active' : 'border-border-default',
              )}
            >
              {passed ? <Icon as={Check} size={9} strokeWidth={3} className="text-white" /> : null}
            </View>
            <Text className={cn('text-sm', passed ? 'text-ink-900' : 'text-ink-400')}>
              {t(`auth.passwordRules.${rule}`)}
            </Text>
          </View>
        );
      })}
    </View>
  );
}
