import {
  Alert,
  AlertDescription,
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogHero,
  DialogHeroPlate,
  DialogTitle,
} from '@oppenheimer/design-system-web';
import { TriangleAlert } from '@oppenheimer/design-system-web/icons';
import { useErrorMessage } from '@oppenheimer/frontend-core/react';
import { useTranslation } from 'react-i18next';

/**
 * The workspace's "are you sure?" — a hero-plated dialog whose confirm button
 * is destructive, for an action that cannot be undone.
 *
 * At the top of `components/` rather than inside `team/`, where it was written:
 * the inbox's bulk delete is the second feature to need it, and layout
 * vocabulary shared by two features does not live inside one of them.
 *
 * The failure stays *in* the dialog as an `Alert` rather than becoming a toast,
 * because the reader has to act on it and the dialog is where they still are.
 */
export function ConfirmDialog({
  title,
  description,
  confirmLabel,
  pending,
  error,
  onClose,
  onConfirm,
}: {
  title: string;
  description: string;
  /** Names the deed — "Delete" — where the generic "Confirm" would not. */
  confirmLabel?: string;
  pending: boolean;
  error: Error | null;
  onClose: () => void;
  onConfirm: () => void;
}) {
  const { t } = useTranslation();
  const resolveError = useErrorMessage();
  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <DialogHero gradient="pinkCoral">
          <DialogHeroPlate>
            <TriangleAlert className="text-destructive" />
          </DialogHeroPlate>
        </DialogHero>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        {error && (
          <Alert variant="destructive">
            <AlertDescription>{resolveError(error, t('common.error')).message}</AlertDescription>
          </Alert>
        )}
        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose}>
            {t('common.cancel')}
          </Button>
          <Button type="button" variant="destructive" disabled={pending} onClick={onConfirm}>
            {confirmLabel ?? t('common.confirm')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
