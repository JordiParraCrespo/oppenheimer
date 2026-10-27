import { EmptyState } from '@oppenheimer/design-system-web';
import { GlobeIcon } from '@oppenheimer/design-system-web/icons';
import { LoadingStatus } from '@oppenheimer/frontend-web';

/**
 * What the Browser tab says in place of a page: waiting for a dev server, a
 * host away, a runner that cannot share its ports, a page being opened.
 * `busy` is a wait the reader need not act on, and says so to a screen reader.
 */
export function BrowserMessage({
  title,
  detail,
  busy = false,
}: {
  title: string;
  detail?: string;
  busy?: boolean;
}) {
  return (
    <EmptyState className="m-auto max-w-80" aria-busy={busy || undefined}>
      {busy ? <LoadingStatus /> : null}
      <EmptyState.Header>
        <EmptyState.Media variant="icon">
          <GlobeIcon />
        </EmptyState.Media>
        <EmptyState.Title>{title}</EmptyState.Title>
        {detail ? <EmptyState.Description>{detail}</EmptyState.Description> : null}
      </EmptyState.Header>
    </EmptyState>
  );
}
