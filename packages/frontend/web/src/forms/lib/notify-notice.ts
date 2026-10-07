import { toast } from '@oppenheimer/design-system-web';
import { type ToastKey, translateToast } from './notify-success';

/**
 * Says what an answer could not include, when the page draws fine without it:
 * a part of some rows is missing and will be there on the next read. It is not
 * a failure the reader has to answer — that stays on the page as an
 * `ErrorAlert` (`.agents/rules/frontend-ui.md`) — and it is not a success, so
 * it carries the information tone and passes.
 *
 * One toast says all of it. A notice per missing part is a column of callouts
 * saying the same sentence with a different noun, which is what this replaced.
 */
export function notifyNotice(key: ToastKey, values?: Record<string, string>): void {
  toast.info(translateToast(key, values));
}
