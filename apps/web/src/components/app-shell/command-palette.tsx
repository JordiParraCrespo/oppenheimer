import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@oppenheimer/design-system-web';
import { useNavigate } from '@tanstack/react-router';
import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuthorizedNav } from '@/components/app-shell/use-authorized-nav';

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

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        onOpenChange(!open);
      }
    };

    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [open, onOpenChange]);

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
