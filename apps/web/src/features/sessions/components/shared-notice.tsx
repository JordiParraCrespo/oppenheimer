import { EmptyState } from '@oppenheimer/design-system-web';
import type { ReactNode } from 'react';
import { SharedFrame } from './shared-frame';

/** Why a share link did not open, centred on the shared page, with its one way on. */
export function SharedNotice({
  title,
  body,
  action,
}: {
  title: string;
  body: string;
  action?: ReactNode;
}) {
  return (
    <SharedFrame>
      <div className="flex flex-1 items-center justify-center p-6">
        <EmptyState>
          <EmptyState.Header>
            <EmptyState.Title>{title}</EmptyState.Title>
            <EmptyState.Description>{body}</EmptyState.Description>
          </EmptyState.Header>
          {action ? <EmptyState.Content>{action}</EmptyState.Content> : null}
        </EmptyState>
      </div>
    </SharedFrame>
  );
}
