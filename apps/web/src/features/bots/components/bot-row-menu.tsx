import {
  DropdownMenu,
  DropdownMenuBack,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuPaneItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  IconButton,
  SearchList,
} from '@oppenheimer/design-system-web';
import { Ellipsis } from '@oppenheimer/design-system-web/icons';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

/**
 * A bot row's ellipsis in the Employees sidebar: Settings, Move to group and
 * Delete bot. Move slides the menu to a pane of the groups it can go to,
 * Ungrouped among them, the way a session's Move to project does. Props in,
 * choice out: the row owns the move and the delete.
 */
export function BotRowMenu({
  open,
  onOpenChange,
  groups,
  groupId,
  onSettings,
  onMove,
  onDelete,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  groups: readonly { id: string; name: string }[];
  /** The group the bot is in now; `null` is Ungrouped. */
  groupId: string | null;
  onSettings: () => void;
  onMove: (groupId: string | null) => void;
  onDelete: () => void;
}) {
  const { t } = useTranslation();
  const [pane, setPane] = useState<'root' | 'move'>('root');
  const targets = [
    ...groups.filter((group) => group.id !== groupId),
    ...(groupId === null ? [] : [{ id: null, name: t('bots.sidebar.ungrouped') }]),
  ];

  return (
    <DropdownMenu
      open={open}
      onOpenChange={(next) => {
        onOpenChange(next);
        if (!next) setPane('root');
      }}
    >
      <DropdownMenuTrigger
        render={<IconButton aria-label={t('bots.sidebar.rowActions')} size="xs" variant="quiet" />}
      >
        <Ellipsis />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className={pane === 'move' ? 'w-68' : 'min-w-47.5'}>
        {pane === 'root' ? (
          <>
            <DropdownMenuItem onClick={onSettings}>{t('bots.sidebar.settings')}</DropdownMenuItem>
            <DropdownMenuPaneItem onClick={() => setPane('move')}>
              {t('bots.sidebar.move')}
            </DropdownMenuPaneItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem variant="destructive" onClick={onDelete}>
              {t('bots.sidebar.delete')}
            </DropdownMenuItem>
          </>
        ) : (
          <>
            <DropdownMenuBack onClick={() => setPane('root')}>
              {t('bots.sidebar.moveTitle')}
            </DropdownMenuBack>
            <DropdownMenuSeparator />
            {targets.length === 0 ? (
              <DropdownMenuItem disabled>{t('bots.sidebar.moveNone')}</DropdownMenuItem>
            ) : (
              <SearchList
                className="-mx-1 -mb-1"
                aria-label={t('bots.sidebar.moveTitle')}
                options={targets.map((target) => ({ value: target.id, label: target.name }))}
                value={groupId}
                onPick={(option) => {
                  onMove(option.value);
                  onOpenChange(false);
                  setPane('root');
                }}
                searchPlaceholder={t('common.search.groups')}
                emptyText={(query) => t('common.search.noMatch', { query })}
              />
            )}
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
