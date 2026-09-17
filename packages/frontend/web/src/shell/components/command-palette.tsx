import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@oppenheimer/design-system-web';
import { useNavigate } from '@tanstack/react-router';
import { useTranslation } from 'react-i18next';
import { useAuthorizedNav } from '../hooks/use-authorized-nav';
import { useHotkey } from '../hooks/use-hotkey';

/**
 * ⌘K. Today it navigates — the destinations come from the same nav model the
 * sidebar renders, so the two can never disagree. Actions and search over
 * workspace content land here as those surfaces arrive.
 */
export function CommandPalette({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { t } = useTranslation();
  const navigate = useNavigate();

  useHotkey(() => onOpenChange(!open));

  // Same authorized set the sidebar renders, so the palette can never jump to a
  // route the user is not allowed to open.
  const entries = useAuthorizedNav();

  return (
    <CommandDialog open={open} onOpenChange={onOpenChange}>
      <CommandInput placeholder={t('nav.commandPlaceholder')} />
      <CommandList>
        <CommandEmpty>{t('nav.commandEmpty')}</CommandEmpty>
        <CommandGroup heading={t('nav.goTo')}>
          {entries.map((entry) => {
            const Icon = entry.icon;

            return (
              <CommandItem
                key={entry.to}
                value={t(`nav.${entry.labelKey}`)}
                onSelect={() => {
                  onOpenChange(false);
                  navigate({ to: entry.to });
                }}
              >
                <Icon />
                {t(`nav.${entry.labelKey}`)}
              </CommandItem>
            );
          })}
        </CommandGroup>
      </CommandList>
    </CommandDialog>
  );
}
