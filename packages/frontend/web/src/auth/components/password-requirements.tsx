import { cn } from '@oppenheimer/design-system-web';
import { Check } from '@oppenheimer/design-system-web/icons';
import {
  checkPassword,
  meetsPasswordRequirements,
  type PasswordRule,
} from '@oppenheimer/frontend-core';
import { useTranslation } from 'react-i18next';

export { checkPassword, meetsPasswordRequirements as meetsRequirements, type PasswordRule };

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
    <ul className={cn('flex list-none flex-col gap-[7px] p-0', className)}>
      {rules.map((rule) => {
        const passed = results[rule];

        return (
          <li
            key={rule}
            className={cn(
              'flex items-center gap-2 text-sm transition-colors',
              passed ? 'text-ink-900' : 'text-ink-400',
            )}
          >
            <span
              className={cn(
                'flex size-4 shrink-0 items-center justify-center rounded-full border-[1.5px] transition-colors',
                passed ? 'border-status-active bg-status-active' : 'border-border-default',
              )}
            >
              <Check
                className={cn(
                  'size-[9px] stroke-[3] text-white transition-opacity',
                  passed ? 'opacity-100' : 'opacity-0',
                )}
              />
            </span>
            {t(`auth.passwordRules.${rule}`)}
          </li>
        );
      })}
    </ul>
  );
}
