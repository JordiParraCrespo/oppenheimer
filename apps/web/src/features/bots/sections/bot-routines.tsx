import { Button, EmptyState } from '@oppenheimer/design-system-web';
import { useSuspenseBotRoutines } from '@oppenheimer/frontend-consumer/react';
import { ErrorAlert } from '@oppenheimer/frontend-web';
import { Link } from '@tanstack/react-router';
import { useTranslation } from 'react-i18next';
import { BotRoutineRow } from './bot-routine-row';

/**
 * A bot's routines as cards, oldest first; each card owns its switch, Run
 * now, Edit and Delete. With none, the page says what a routine is and
 * where one is made: the chat.
 */
export function BotRoutines({ botId }: { botId: string }) {
  const { t } = useTranslation();
  const { data: routines, error } = useSuspenseBotRoutines(botId);

  return (
    <section className="flex flex-col gap-3">
      <ErrorAlert error={error} fallback={t('bots.settings.routines.loadFailed')} />
      {routines.length === 0 ? (
        <EmptyState>
          <EmptyState.Header>
            <EmptyState.Description>{t('bots.settings.routines.empty')}</EmptyState.Description>
          </EmptyState.Header>
          <EmptyState.Content>
            <Button
              variant="secondary"
              size="sm"
              render={<Link to="/bots/$botId" params={{ botId }} />}
            >
              {t('bots.settings.routines.askInChat')}
            </Button>
          </EmptyState.Content>
        </EmptyState>
      ) : (
        routines.map((routine) => (
          <BotRoutineRow key={routine.id} botId={botId} routine={routine} />
        ))
      )}
    </section>
  );
}
