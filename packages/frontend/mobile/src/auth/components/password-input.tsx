import { Icon } from '@oppenheimer/design-system-mobile/icon';
import { Eye, EyeOff } from '@oppenheimer/design-system-mobile/icons';
import { Input } from '@oppenheimer/design-system-mobile/input';
import { cn } from '@oppenheimer/design-system-mobile/utils';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, View } from 'react-native';
import { authInputClass } from './auth-primitives';

/**
 * A password field with the reveal toggle parked inside its right gutter — the
 * same control `@oppenheimer/frontend-web` ships, so both platforms let a person
 * check what they typed before submitting. Everything but the toggle is the
 * design system's `Input`.
 */
export function PasswordInput({
  className,
  ...props
}: Omit<React.ComponentProps<typeof Input>, 'secureTextEntry'>) {
  const { t } = useTranslation();
  const [visible, setVisible] = useState(false);

  return (
    <View className="relative">
      <Input
        {...props}
        secureTextEntry={!visible}
        className={cn(authInputClass, 'pr-12', className)}
      />
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={visible ? t('auth.hidePassword') : t('auth.showPassword')}
        onPress={() => setVisible((shown) => !shown)}
        className="absolute bottom-0 right-1.5 top-0 w-9 items-center justify-center rounded-md"
      >
        <Icon as={visible ? EyeOff : Eye} size={17} className="text-ink-400" />
      </Pressable>
    </View>
  );
}
