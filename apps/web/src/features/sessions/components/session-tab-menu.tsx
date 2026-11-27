import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from '@oppenheimer/design-system-web';
import { useTranslation } from 'react-i18next';
import type { CloseTabs } from '../lib/open-tabs';

/** Where a right-click opened the menu, as the point the menu is anchored at. */
export type TabMenuPoint = { x: number; y: number };

/**
 * A tab's right-click menu over Sessions, the closes a browser's tab menu
 * offers: this tab, the others, those to its left or right, all of them. A
 * close with nothing to close (the first tab's left, a lone tab's others) is
 * offered disabled, so the menu keeps one shape.
 */
export function SessionTabMenu({
  open,
  at,
  index,
  count,
  onClose,
  onDismiss,
}: {
  open: boolean;
  /** Where it opened; null before it first has. */
  at: TabMenuPoint | null;
  /** The place, in the strip, of the tab it opened on. */
  index: number;
  /** How many tabs the strip draws. */
  count: number;
  onClose: (which: CloseTabs) => void;
  onDismiss: () => void;
}) {
  const { t } = useTranslation();
  const anchor = at
    ? { getBoundingClientRect: () => DOMRect.fromRect({ x: at.x, y: at.y, width: 0, height: 0 }) }
    : undefined;
  return (
    <DropdownMenu
      open={open}
      onOpenChange={(next) => {
        if (!next) onDismiss();
      }}
    >
      <DropdownMenuContent anchor={anchor} sideOffset={2}>
        <DropdownMenuItem onClick={() => onClose('this')}>
          {t('sessions.tabs.menu.close')}
        </DropdownMenuItem>
        <DropdownMenuItem disabled={count < 2} onClick={() => onClose('others')}>
          {t('sessions.tabs.menu.closeOthers')}
        </DropdownMenuItem>
        <DropdownMenuItem disabled={index === 0} onClick={() => onClose('left')}>
          {t('sessions.tabs.menu.closeLeft')}
        </DropdownMenuItem>
        <DropdownMenuItem disabled={index >= count - 1} onClick={() => onClose('right')}>
          {t('sessions.tabs.menu.closeRight')}
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={() => onClose('all')}>
          {t('sessions.tabs.menu.closeAll')}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
