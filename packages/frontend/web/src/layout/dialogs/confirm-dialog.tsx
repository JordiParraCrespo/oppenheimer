import {
  Button,
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@oppenheimer/design-system-web';
import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { ErrorAlert } from '../../forms';

/**
 * The console's "are you sure?", as the inventory draws it
 * (`product/versions/mvp/design/version1/Components.dc.html`, "Dialog ·
 * Destructive confirm"): the title names the thing, the description states the
 * cost, and the destructive button repeats the verb — never "Confirm", which is
 * why `confirmLabel` is required. Cancel is `secondary`, as it is on every
 * dialog foot in the export.
 *
 * Each caller keeps its own mutation and hands over its state: `pending` locks
 * both buttons and the dismissal, and swaps the verb for `pendingLabel`;
 * `error`, when the caller has one (with its `errorFallback`), stays *in* the dialog, through `ErrorAlert`, because the reader has
 * to act on it and the dialog is where they still are.
 *
 * `children` is what one confirm needs beyond the sentence — Delete session's
 * box for unpushed work, Delete account's typed email. A child that is a form
 * passes its id as `form`, and the destructive button submits it instead of
 * calling `onConfirm`, so the form's own validation runs first.
 *
 * Smaller confirmations stay inside the menu that asked (the export's
 * automation delete); this is for the ones that earn a dialog.
 */
export function ConfirmDialog({
  title,
  description,
  confirmLabel,
  pendingLabel,
  pending,
  error,
  errorFallback,
  onClose,
  onConfirm,
  form,
  children,
}: {
  title: ReactNode;
  description: ReactNode;
  /** The verb — "Delete session" — never the generic "Confirm". */
  confirmLabel: string;
  /** The verb in progress — "Deleting…" — while `pending`. */
  pendingLabel?: string;
  pending: boolean;
  onClose: () => void;
  onConfirm?: () => void;
  /** The id of a form in `children` that the destructive button submits. */
  form?: string;
  children?: ReactNode;
} & (
  | {
      /** The mutation's failure, kept in the dialog. */
      error: unknown;
      /** Already translated: what the failure reads as when its code has no message. */
      errorFallback: string;
    }
  | { error?: undefined; errorFallback?: undefined }
)) {
  const { t } = useTranslation();
  const hasBody = Boolean(children) || (error !== null && error !== undefined);

  return (
    <Dialog open onOpenChange={(open) => !open && !pending && onClose()}>
      <DialogContent role="alertdialog" closeLabel={t('common.close')}>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        {hasBody ? (
          <DialogBody className="flex flex-col gap-3">
            {children}
            <ErrorAlert error={error} fallback={errorFallback ?? ''} />
          </DialogBody>
        ) : null}
        <DialogFooter>
          <Button type="button" variant="secondary" onClick={onClose} disabled={pending}>
            {t('common.cancel')}
          </Button>
          <Button
            type={form ? 'submit' : 'button'}
            form={form}
            variant="destructive"
            pending={pending}
            pendingLabel={pendingLabel}
            onClick={form ? undefined : onConfirm}
          >
            {confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
