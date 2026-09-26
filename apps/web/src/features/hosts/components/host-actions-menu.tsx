import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  IconButton,
} from '@oppenheimer/design-system-web';
import { Ellipsis } from '@oppenheimer/design-system-web/icons';
import { useTranslation } from 'react-i18next';

/**
 * The ellipsis on a host card: Rename, then Remove host. The frame's Copy
 * host ID is left out for now (decided 2026-09-26). Props only — the row
 * owns what each one opens.
 */
export function HostActionsMenu({
  name,
  onRename,
  onRemove,
}: {
  name: string;
  onRename: () => void;
  onRemove: () => void;
}) {
  const { t } = useTranslation();
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <IconButton
            size="sm"
            variant="quiet"
            aria-label={t('hosts.settings.actions', { name })}
          />
        }
      >
        <Ellipsis />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" sideOffset={6}>
        <DropdownMenuItem onClick={onRename}>{t('hosts.settings.rename')}</DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem variant="destructive" onClick={onRemove}>
          {t('hosts.settings.remove')}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
