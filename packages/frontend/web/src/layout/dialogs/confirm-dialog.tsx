import {
  Button,
  Checkbox,
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Field,
  FieldLabel,
} from '@oppenheimer/design-system-web';
import { type ReactNode, useId } from 'react';
import { useTranslation } from 'react-i18next';
import { ErrorAlert } from '../../forms';

/**
 * The console's "are you sure?", as the inventory draws it
 * (`product/versions/mvp/design/version1/Components.dc.html`, "Dialog ·
 * Destructive confirm"): the title names the thing, the description states the
 * cost, and the destructive button repeats the verb — never "Confirm", which is
 * why `confirmLabel` is required. Cancel is `secondary`, as on every dialog foot.
 *
 * Each caller keeps its own mutation and hands over its state: `pending` locks
 * both buttons and the dismissal and swaps in `pendingLabel`; `error` (with
 * `errorFallback`) stays *in* the dialog through `ErrorAlert`, because the
 * reader has to act on it there.
 *
 * Every confirm reads the same way:
 *
 * - the title is the verb and the thing, named: `Delete “Bump RN”?`, `Remove
 *   “build-02”?`; only a thing with no name of its own says what it is
 *   (`Delete your account?`, `Clear the chat history?`);
 * - the description is the cost: what is lost and what stays. It does not say
 *   the name again;
 * - `confirmLabel` is the verb and the noun (`Delete task`), and
 *   `pendingLabel` the verb in progress (`Deleting…`), always both.
 *
 * `children` is what one confirm needs beyond the sentence. A choice the reader
 * can opt into (Delete session's unpushed-work box, Remove host's clean-up) is
 * a `ConfirmDialog.Option`, never a checkbox of the caller's own; Delete
 * account's typed email is a form. A child form passes its id
 * as `form`, and the destructive button submits it instead of calling
 * `onConfirm`, so its validation runs first. Smaller confirmations stay in the
 * menu that asked.
 *
 * `tone="primary"` is for a confirm that costs a moment rather than
 * something lost (Update runner restarts the runner; nothing is deleted): the
 * same dialog with the primary button.
 */
function ConfirmDialogRoot({
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
  tone = 'destructive',
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
  /** The confirm button's colour: red for a loss, primary for a restart. */
  tone?: 'destructive' | 'primary';
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
            variant={tone}
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

/**
 * One choice inside a confirm: a checkbox with its sentence beside it. The
 * label sits next to the box rather than around it, because a `FieldLabel`
 * that wraps a checked box paints the selected-card background, which a
 * confirm's option is not. Clicking the sentence ticks the box.
 */
function ConfirmDialogOption({
  checked,
  onCheckedChange,
  disabled,
  children,
}: {
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  disabled?: boolean;
  /** The sentence: what ticking it adds to the cost, or why it cannot be ticked. */
  children: ReactNode;
}) {
  const id = useId();
  return (
    <Field orientation="horizontal" className="items-start">
      <Checkbox
        id={id}
        checked={checked}
        onCheckedChange={(next) => onCheckedChange(next === true)}
        disabled={disabled}
      />
      <FieldLabel htmlFor={id}>{children}</FieldLabel>
    </Field>
  );
}

export const ConfirmDialog = Object.assign(ConfirmDialogRoot, { Option: ConfirmDialogOption });
