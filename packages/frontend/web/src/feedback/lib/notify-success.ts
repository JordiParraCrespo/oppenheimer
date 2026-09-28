import { toast } from '@oppenheimer/design-system-web';

/** A button on the toast that takes the reader to what just happened. */
export interface SuccessAction {
  label: string;
  onClick: () => void;
}

/**
 * Says that a write landed, when its result is not where the reader is
 * looking or is easy to miss: a row that changed in a long list, a
 * background action, anything that navigates away from where it started.
 * A screen that navigates to the result or shows a "done" view says nothing.
 * The rule is in `.agents/rules/frontend-ui.md`.
 *
 * Success only. A failure stays inline, next to what the reader has to fix.
 * The message is a translated `toasts.*` string, with the object's name
 * interpolated where it has one.
 *
 * The `<Toaster />` is mounted once at the app root, so a toast fired
 * before or after a navigation survives it.
 */
export function notifySuccess(message: string, action?: SuccessAction): void {
  toast.success(message, action ? { action } : undefined);
}
