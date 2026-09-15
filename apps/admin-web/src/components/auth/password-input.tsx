import { cn, IconButton, Input } from '@oppenheimer/design-system-web';
import { Eye, EyeOff } from '@oppenheimer/design-system-web/icons';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { authInputClass } from './auth-primitives';

/**
 * A password field with the reveal toggle parked inside its right gutter.
 * Everything but the toggle is the design system's `Input`, so it keeps the
 * same hairline, focus ring and disabled treatment as every other control.
 */
export function PasswordInput({
  className,
  ...props
}: Omit<React.ComponentProps<'input'>, 'type' | 'size'>) {
  const { t } = useTranslation();
  const [visible, setVisible] = useState(false);
  const Icon = visible ? EyeOff : Eye;

  return (
    <div className="relative">
      <Input
        {...props}
        type={visible ? 'text' : 'password'}
        className={cn(authInputClass, 'pr-11', className)}
      />
      <IconButton
        type="button"
        variant="ghost"
        size="default"
        aria-label={visible ? t('auth.hidePassword') : t('auth.showPassword')}
        onClick={() => setVisible((shown) => !shown)}
        className="absolute top-1/2 right-2 size-[30px] -translate-y-1/2 rounded-md"
      >
        <Icon className="size-4 text-ink-600 opacity-60" />
      </IconButton>
    </div>
  );
}
