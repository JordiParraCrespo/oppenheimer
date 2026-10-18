import { RoutineCard } from '@oppenheimer/design-system-web';
import { Clock, GitPullRequest } from '@oppenheimer/design-system-web/icons';
import type { BotRoutineEntity } from '@oppenheimer/frontend-consumer';
import { useRunBotRoutine, useSetBotRoutineEnabled } from '@oppenheimer/frontend-consumer/react';
import { ErrorAlert, useLocale } from '@oppenheimer/frontend-web';
import { useNavigate } from '@tanstack/react-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { DeleteBotRoutineDialog } from '@/features/bots/dialogs/delete-bot-routine';
import { fillBotDraft } from '@/features/bots/lib/bot-drafts';
import { routineMoment, routineWhen } from '@/features/bots/lib/routine-text';

/**
 * One routine as a card (`26-bot-routines.md` §7): its switch, Run now, Edit
 * and Delete. Edit does not open a form: it writes "Edit your routine: …"
 * into the bot's chat and goes there, so the bot changes it with its own
 * tool and asks first, as the chat is where a routine is made.
 */
export function BotRoutineRow({ botId, routine }: { botId: string; routine: BotRoutineEntity }) {
  const { t } = useTranslation();
  const locale = useLocale();
  const navigate = useNavigate();
  const [deleting, setDeleting] = useState(false);
  const toggle = useSetBotRoutineEnabled();
  const run = useRunBotRoutine();
  const [first] = routine.triggers;

  return (
    <div className="flex flex-col gap-2">
      <RoutineCard
        name={routine.name}
        icon={first?.source === 'github' ? <GitPullRequest /> : <Clock />}
        trigger={routineWhen(routine, locale, t)}
        prompt={routine.prompt}
        last={
          routine.lastRun
            ? routineMoment(routine.lastRun.createdAt, locale)
            : t('bots.settings.routines.never')
        }
        next={routine.nextRunAt ? routineMoment(routine.nextRunAt, locale) : undefined}
        active={!routine.isPaused}
        onActiveChange={(enabled) => toggle.mutate({ id: botId, routineId: routine.id, enabled })}
        running={routine.isRunning || run.isPending}
        onRun={() =>
          run.mutate({ id: botId, routineId: routine.id, idempotencyKey: crypto.randomUUID() })
        }
        onEdit={() => {
          fillBotDraft(botId, t('bots.settings.routines.editPrompt', { name: routine.name }));
          void navigate({ to: '/bots/$botId', params: { botId } });
        }}
        onDelete={() => setDeleting(true)}
        labels={{
          active: t('bots.settings.routines.switch', { name: routine.name }),
          pause: t('bots.settings.routines.pause'),
          resume: t('bots.settings.routines.resume'),
          run: t('bots.settings.routines.run'),
          running: t('bots.settings.routines.running'),
          edit: t('bots.settings.routines.edit'),
          delete: t('bots.settings.routines.delete'),
          last: t('bots.settings.routines.last'),
          next: t('bots.settings.routines.next'),
        }}
      />
      <ErrorAlert
        error={toggle.error}
        fallback={t('bots.settings.routines.switchFailed')}
        onDismiss={() => toggle.reset()}
      />
      <ErrorAlert
        error={run.error}
        fallback={t('bots.settings.routines.runFailed')}
        onDismiss={() => run.reset()}
      />
      {deleting ? (
        <DeleteBotRoutineDialog
          botId={botId}
          routineId={routine.id}
          name={routine.name}
          onClose={() => setDeleting(false)}
        />
      ) : null}
    </div>
  );
}
