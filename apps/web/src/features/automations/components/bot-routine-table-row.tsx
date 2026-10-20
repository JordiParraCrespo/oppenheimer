import { RoutineTableRow } from '@oppenheimer/design-system-web';
import { Bot } from '@oppenheimer/design-system-web/icons';
import type { BotRoutineEntity } from '@oppenheimer/frontend-consumer';
import { useTranslation } from 'react-i18next';
import { RoutineNextRun } from './routine-next-run';

/**
 * One bot routine on the overview (`26-bot-routines.md` §7): its name over
 * the bot that runs it, its trigger in words, its next run and its status.
 * It opens the bot's Routines tab, where it is switched, run and deleted;
 * the chat is where it is changed, so there is no menu here.
 */
export function BotRoutineTableRow({
  routine,
  botName,
  trigger,
  onOpen,
}: {
  routine: BotRoutineEntity;
  botName: string | undefined;
  trigger: string;
  onOpen: () => void;
}) {
  const { t } = useTranslation();
  return (
    <RoutineTableRow
      tabIndex={0}
      aria-label={routine.name}
      icon={<Bot size={15} aria-hidden />}
      name={routine.name}
      sub={botName ? t('automations.routines.runsOn', { bot: botName }) : undefined}
      trigger={trigger}
      next={<RoutineNextRun routine={routine} />}
      status={routine.isRunning ? 'running' : routine.isPaused ? 'paused' : 'active'}
      statusLabel={t(`automations.status.${routine.status}`)}
      paused={routine.isPaused}
      onClick={onOpen}
      onKeyDown={(event) => {
        if (event.target === event.currentTarget && (event.key === 'Enter' || event.key === ' ')) {
          event.preventDefault();
          onOpen();
        }
      }}
    />
  );
}
