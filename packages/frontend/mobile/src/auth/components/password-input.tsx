import { Icon } from '@oppenheimer/design-system-mobile/icon';
import { Eye, EyeOff } from '@oppenheimer/design-system-mobile/icons';
import { cn } from '@oppenheimer/design-system-mobile/utils';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, TextInput, View } from 'react-native';
import { authControlClass } from './auth-primitives';

/**
 * A password field with its reveal toggle, as the export draws it: one
 * bordered box, the text and then the eye, side by side. The eye is laid out
 * beside the text rather than floated over it, so however long the password
 * the box holds both and neither leaves the screen.
 */
export function PasswordInput({
  className,
  editable,
  ...props
}: Omit<React.ComponentProps<typeof TextInput>, 'secureTextEntry'>) {
  const { t } = useTranslation();
  const [visible, setVisible] = useState(false);

  return (
    <View
      className={cn(
        authControlClass,
        'flex-row items-center rounded-md border border-border-default bg-card pl-[13px]',
        editable === false && 'opacity-50',
        className,
      )}
    >
      <TextInput
        {...props}
        editable={editable}
        secureTextEntry={!visible}
        className="h-full min-w-0 flex-1 text-base text-foreground placeholder:text-ink-400"
        textAlignVertical="center"
      />
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={visible ? t('auth.hidePassword') : t('auth.showPassword')}
        onPress={() => setVisible((shown) => !shown)}
        hitSlop={8}
        className="h-full w-11 items-center justify-center"
      >
        <Icon as={visible ? EyeOff : Eye} size={17} className="text-ink-400" />
      </Pressable>
    </View>
  );
}
