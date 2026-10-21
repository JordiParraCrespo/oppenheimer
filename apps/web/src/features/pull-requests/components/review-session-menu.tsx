import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  IconButton,
} from '@oppenheimer/design-system-web';
import { Ellipsis } from '@oppenheimer/design-system-web/icons';
import { useTranslation } from 'react-i18next';

/** A For review row's ellipsis: Delete. Props in, choice out: the row owns the dialog. */
export function ReviewSessionMenu({
  open,
  onOpenChange,
  onDelete,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onDelete: () => void;
}) {
  const { t } = useTranslation();

  return (
    <DropdownMenu open={open} onOpenChange={onOpenChange}>
      <DropdownMenuTrigger
        render={<IconButton aria-label={t('sessions.sidebar.actions')} size="xs" variant="quiet" />}
      >
        <Ellipsis />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-47.5">
        <DropdownMenuItem variant="destructive" onClick={onDelete}>
          {t('sessions.sidebar.delete')}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
