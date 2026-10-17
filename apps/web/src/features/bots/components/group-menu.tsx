import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  IconButton,
} from '@oppenheimer/design-system-web';
import { Ellipsis } from '@oppenheimer/design-system-web/icons';
import { useTranslation } from 'react-i18next';

/** A group head's ellipsis: Rename group, Delete group (its bots stay, ungrouped). */
export function GroupMenu({
  name,
  onRename,
  onDelete,
}: {
  name: string;
  onRename: () => void;
  onDelete: () => void;
}) {
  const { t } = useTranslation();
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <IconButton aria-label={t('bots.sidebar.groupActions', { name })} variant="quiet" />
        }
      >
        <Ellipsis />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-45">
        <DropdownMenuItem onClick={onRename}>{t('bots.sidebar.renameGroup')}</DropdownMenuItem>
        <DropdownMenuItem variant="destructive" onClick={onDelete}>
          {t('bots.sidebar.deleteGroup')}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
