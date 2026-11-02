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
 * A bot row's ellipsis under a section's Bots heading: Settings, Hide from
 * the section (`where`, its name), which takes the bot off this sidebar only
 * (it stays in Employees and wherever else it is placed), and Delete bot,
 * which removes it everywhere. Props in, choice out: the row owns the writes.
 */
export function SectionBotRowMenu({
  open,
  onOpenChange,
  where,
  onSettings,
  onHide,
  onDelete,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  where: string;
  onSettings: () => void;
  onHide: () => void;
  onDelete: () => void;
}) {
  const { t } = useTranslation();

  return (
    <DropdownMenu open={open} onOpenChange={onOpenChange}>
      <DropdownMenuTrigger
        render={<IconButton aria-label={t('bots.sidebar.rowActions')} size="xs" variant="quiet" />}
      >
        <Ellipsis />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-47.5">
        <DropdownMenuItem onClick={onSettings}>{t('bots.sidebar.settings')}</DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={onHide}>
          {t('bots.section.hide', { section: where })}
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem variant="destructive" onClick={onDelete}>
          {t('bots.sidebar.delete')}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
