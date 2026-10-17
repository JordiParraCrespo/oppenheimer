import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  IconButton,
} from '@oppenheimer/design-system-web';
import { Ellipsis, Settings2, Trash2 } from '@oppenheimer/design-system-web/icons';
import { useTranslation } from 'react-i18next';

/**
 * The ellipsis over a bot's chat or its settings: Settings where there is
 * somewhere to go, then Delete bot. Props in, choice out.
 */
export function BotActionsMenu({
  onSettings,
  onDelete,
}: {
  /** Left out on the settings themselves. */
  onSettings?: () => void;
  onDelete: () => void;
}) {
  const { t } = useTranslation();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={<IconButton aria-label={t('bots.chat.actions')} size="sm" variant="quiet" />}
      >
        <Ellipsis />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-45">
        {onSettings ? (
          <>
            <DropdownMenuItem onClick={onSettings}>
              <Settings2 />
              {t('bots.chat.settings')}
            </DropdownMenuItem>
            <DropdownMenuSeparator />
          </>
        ) : null}
        <DropdownMenuItem variant="destructive" onClick={onDelete}>
          <Trash2 />
          {t('bots.chat.delete')}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
