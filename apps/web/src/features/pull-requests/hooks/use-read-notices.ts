import type { ReadRefusal, UnreadableRepository } from '@oppenheimer/frontend-consumer';
import { notifyNotice, type ToastKey } from '@oppenheimer/frontend-web';
import { useEffect, useRef } from 'react';

/** One sentence per refusal, so the toast says what GitHub did rather than listing nouns. */
const SAID: Record<ReadRefusal, ToastKey> = {
  rate_limited: 'pullRequestsSlowedDown',
  forbidden: 'pullRequestsRefused',
  not_found: 'pullRequestsGone',
  failed: 'pullRequestsUnanswered',
};

/**
 * What a read could not show, said once (#244). A gap is not the reader's to
 * answer — the rows are drawn and a part of them will be there on the next
 * read — so it passes as one notice rather than standing on the page as a
 * callout per repository, part and refusal, which is a column of near-identical
 * sentences the moment GitHub throttles one account.
 *
 * Checks refused for want of access is the exception that earns its own
 * wording: it is the one gap a reader can close, by granting the App its
 * permissions.
 */
export function useReadNotices(unreadable: readonly UnreadableRepository[] | undefined): void {
  // The effect synchronises with the toaster, which lives outside React's tree;
  // the ref keeps one answer from being said twice as the query settles.
  const said = useRef<string | null>(null);
  useEffect(() => {
    const gaps = unreadable ?? [];
    const signature = gaps
      .map((gap) => `${gap.fullName}|${gap.what}|${gap.refusal}`)
      .sort()
      .join(',');
    if (signature === said.current) return;
    said.current = signature;
    if (gaps.length === 0) return;
    const permission = gaps.some((gap) => gap.what === 'checks' && gap.refusal === 'forbidden');
    const refusals = new Set(gaps.map((gap) => gap.refusal));
    const only = refusals.size === 1 ? [...refusals][0] : undefined;
    notifyNotice(
      permission ? 'pullRequestsChecksPermission' : only ? SAID[only] : 'pullRequestsIncomplete',
    );
  }, [unreadable]);
}
