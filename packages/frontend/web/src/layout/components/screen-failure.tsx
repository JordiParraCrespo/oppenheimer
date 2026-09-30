import { EmptyState } from '@oppenheimer/design-system-web';
import { CircleAlert } from '@oppenheimer/design-system-web/icons';
import type { ReactNode } from 'react';

/**
 * A failure that is the whole screen: the design's empty state with the alert
 * disc, a title, the sentence, an optional mono detail line (a code, a
 * correlation id) and the one action that can fix it.
 */
export function ScreenFailure({
  title,
  description,
  detail,
  action,
  children,
}: {
  title: ReactNode;
  description: ReactNode;
  detail?: ReactNode;
  action: ReactNode;
  /** Rendered after the action; for what is in the DOM but not on screen. */
  children?: ReactNode;
}) {
  return (
    <EmptyState className="my-auto">
      <EmptyState.Header>
        <EmptyState.Media variant="icon">
          <CircleAlert />
        </EmptyState.Media>
        <EmptyState.Title>{title}</EmptyState.Title>
        <EmptyState.Description>{description}</EmptyState.Description>
        {detail ? (
          <EmptyState.Description className="font-mono text-xs">{detail}</EmptyState.Description>
        ) : null}
      </EmptyState.Header>
      <EmptyState.Content>{action}</EmptyState.Content>
      {children}
    </EmptyState>
  );
}
