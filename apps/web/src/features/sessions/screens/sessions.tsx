import { Button, EmptyState } from '@oppenheimer/design-system-web';
import { Plus, Terminal } from '@oppenheimer/design-system-web/icons';
import { useSessions } from '@oppenheimer/frontend-consumer/react';
import { Link } from '@tanstack/react-router';
import { useTranslation } from 'react-i18next';

/**
 * The console with no session open: `/sessions` itself.
 *
 * The sidebar is the list now, so this pane is not a second one — it is what
 * the artboard draws in the same place a terminal goes, and it says what the
 * pane is for: "start one and the terminal takes over this pane".
 *
 * It reads the list only to know which of two sentences is true. A reader with
 * sessions came here by leaving one and is told where the others are; a reader
 * with none is being told what the product does. Neither is a list: while the
 * request is in flight the pane stays empty rather than flashing the wrong
 * sentence and correcting itself.
 */
export function SessionsScreen() {
  const { t } = useTranslation();
  const { data: sessions } = useSessions();

  if (!sessions) return null;

  const hasSessions = sessions.length > 0;

  return (
    <EmptyState className="my-auto">
      <EmptyState.Header>
        <EmptyState.Media variant="icon">
          <Terminal />
        </EmptyState.Media>
        <EmptyState.Title>
          {t(hasSessions ? 'sessions.home.openTitle' : 'sessions.home.emptyTitle')}
        </EmptyState.Title>
        <EmptyState.Description>
          {t(hasSessions ? 'sessions.home.openDescription' : 'sessions.home.emptyDescription')}
        </EmptyState.Description>
      </EmptyState.Header>
      <EmptyState.Content>
        <Button render={<Link to="/sessions/new" />}>
          <Plus />
          {t('nav.newSession')}
        </Button>
      </EmptyState.Content>
    </EmptyState>
  );
}
