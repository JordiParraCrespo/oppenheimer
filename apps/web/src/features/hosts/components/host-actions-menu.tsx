import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  DropdownMenuTrigger,
  IconButton,
} from '@oppenheimer/design-system-web';
import { Ellipsis } from '@oppenheimer/design-system-web/icons';
import { useTranslation } from 'react-i18next';

/**
 * The ellipsis on a host card and its three rows: Rename, Copy host ID (with
 * the id's head as the shortcut hint, as the frame draws it), and Remove host.
 * Props only — the row owns what each one opens.
 */
export function HostActionsMenu({
  name,
  id,
  onRename,
  onCopyId,
  onRemove,
}: {
  name: string;
  id: string;
  onRename: () => void;
  onCopyId: () => void;
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
        <DropdownMenuItem onClick={onCopyId}>
          {t('hosts.settings.copyId')}
          <DropdownMenuShortcut className="font-mono">{id.slice(0, 8)}</DropdownMenuShortcut>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem variant="destructive" onClick={onRemove}>
          {t('hosts.settings.remove')}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
