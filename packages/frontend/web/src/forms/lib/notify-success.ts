import { toast } from '@oppenheimer/design-system-web';
import type { Messages } from '@oppenheimer/translations/locales';
import { i18n } from '../../i18n';

/** A key under `toasts.*`: the only place a success message's copy may live. */
export type ToastKey = keyof Messages['toasts'];

// `ToastKey` already holds the key to the catalog; i18next's own overloads
// cannot resolve a union of keys, so the call is typed by hand here.
const translate = (key: string, values?: Record<string, string>) =>
  (i18n.t as (key: string, options?: Record<string, string>) => string)(key, values);

/** The same lookup for `notifyNotice`, so both tones take a `toasts.*` key and nothing else. */
export const translateToast = (key: ToastKey, values?: Record<string, string>) =>
  translate(`toasts.${key}`, values);

/**
 * Says that a write landed, when its result is not where the reader is
 * looking (`.agents/rules/frontend-ui.md`). It takes a `toasts.*` key rather
 * than a string, so a success cannot be worded anywhere else, and the same
 * for the label of the button that leads to the result.
 */
export function notifySuccess(
  key: ToastKey,
  values?: Record<string, string>,
  action?: { label: ToastKey; onClick: () => void },
): void {
  toast.success(
    translate(`toasts.${key}`, values),
    action
      ? { action: { label: translate(`toasts.${action.label}`), onClick: action.onClick } }
      : undefined,
  );
}
