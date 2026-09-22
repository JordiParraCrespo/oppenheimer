import { cn } from '@oppenheimer/design-system-web';
import { Moon, Sun } from '@oppenheimer/design-system-web/icons';
import { useTranslation } from 'react-i18next';
import { useTheme } from './theme-provider';

/**
 * The brand's two-up theme pill: a 60×30 hairline capsule whose active half
 * fills with a light grey knob. The knob colour is deliberately the same in
 * both themes — it is the one chrome element that does not invert.
 */
export function ThemeToggle({ className }: { className?: string }) {
  const { t } = useTranslation();
  // The resolution, not the preference: the pill shows which half is lit,
  // and under "Match system" that is whatever the OS is wearing.
  const { resolvedTheme, setTheme } = useTheme();
  const isDark = resolvedTheme === 'dark';

  const half = 'relative flex flex-1 items-center justify-center rounded-full transition-colors';
  const knob = 'bg-theme-toggle-knob';
  const activeIcon = 'text-theme-toggle-icon';
  const idleIcon = 'text-theme-toggle-icon-idle';

  return (
    <button
      type="button"
      aria-label={t('theme.toggle')}
      aria-pressed={isDark}
      onClick={() => setTheme(isDark ? 'light' : 'dark')}
      className={cn(
        'inline-flex h-[30px] w-15 items-stretch rounded-full border border-border-default p-0.5',
        className,
      )}
    >
      <span className={cn(half, !isDark && knob)}>
        <Sun className={cn('size-3.5', isDark ? idleIcon : activeIcon)} />
      </span>
      <span className={cn(half, isDark && knob)}>
        <Moon className={cn('size-3.5', isDark ? activeIcon : idleIcon)} />
      </span>
    </button>
  );
}
