import { Button, EmptyState } from '@oppenheimer/design-system-web';
import { CircleOff, Terminal } from '@oppenheimer/design-system-web/icons';
import { Link } from '@tanstack/react-router';
import { useTranslation } from 'react-i18next';

/**
 * A session whose terminal is gone: stopped or deleted. There is no reattaching
 * to a tmux session that has exited; the caller says which sentence explains
 * why.
 */
export function SessionClosed({
  name,
  copy,
}: {
  name: string;
  copy: 'sessions.closed.description' | 'sessions.closed.deleted';
}) {
  const { t } = useTranslation();

  return (
    <EmptyState className="my-auto">
      <EmptyState.Header>
        <EmptyState.Media variant="icon">
          <CircleOff />
        </EmptyState.Media>
        <EmptyState.Title>{name}</EmptyState.Title>
        <EmptyState.Description>{t(copy)}</EmptyState.Description>
      </EmptyState.Header>
      <EmptyState.Content>
        <Button variant="secondary" render={<Link to="/sessions/new" />}>
          <Terminal />
          {t('nav.newSession')}
        </Button>
      </EmptyState.Content>
    </EmptyState>
  );
}
