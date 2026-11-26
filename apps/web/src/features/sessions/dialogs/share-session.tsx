import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogTitle,
  IconButton,
} from '@oppenheimer/design-system-web';
import { XIcon } from '@oppenheimer/design-system-web/icons';
import { useTranslation } from 'react-i18next';
import { ShareSession } from '../sections/share-session';

/**
 * Share, from a session row's menu or the terminal's status line, where
 * there is no Share button to open it from: the same panel as the session
 * bar's popover, in a dialog its width, its close on the panel's title line.
 */
export function ShareSessionDialog({
  sessionId,
  onClose,
}: {
  sessionId: string;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent size="md" showCloseButton={false} className="max-w-105 gap-0 rounded-lg p-0">
        <ShareSession sessionId={sessionId} Title={DialogTitle} />
        <DialogClose
          render={
            <IconButton
              variant="quiet"
              size="sm"
              aria-label={t('common.close')}
              className="absolute top-2.5 right-2.5"
            />
          }
        >
          <XIcon />
        </DialogClose>
      </DialogContent>
    </Dialog>
  );
}
