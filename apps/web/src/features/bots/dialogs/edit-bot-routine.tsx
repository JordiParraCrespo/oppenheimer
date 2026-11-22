import {
  Button,
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@oppenheimer/design-system-web';
import type { BotRoutineEntity } from '@oppenheimer/frontend-consumer';
import { useUpdateBotRoutine } from '@oppenheimer/frontend-consumer/react';
import { ErrorAlert, useLocale } from '@oppenheimer/frontend-web';
import type { BotRoutineTaskDto } from '@oppenheimer/shared/schemas/bot';
import { useNavigate } from '@tanstack/react-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { BotRoutineForm } from '@/features/bots/forms/bot-routine-form';
import { fillBotDraft } from '@/features/bots/lib/bot-drafts';
import { routineWhen } from '@/features/bots/lib/routine-text';

/**
 * Edit a routine by hand: its name and its prompt. When it runs is read here
 * and changed in the chat, where the bot's own tool sets triggers; Ask in
 * chat writes "Edit your routine: …" into the composer and goes there.
 */
export function EditBotRoutineDialog({
  botId,
  routine,
  onClose,
}: {
  botId: string;
  routine: BotRoutineEntity;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const locale = useLocale();
  const navigate = useNavigate();
  const update = useUpdateBotRoutine({ onSuccess: onClose });
  // The routine as the dialog opened on it: the form is seeded from it once,
  // so a refetch while it is open (another tab, the bot) must not make an
  // untouched field look edited and write the old value back over the new.
  const [opened] = useState(routine);

  // Only what was changed here is sent, so a field the reader left alone
  // never writes this dialog's copy over a newer one; with nothing changed
  // there is nothing to send.
  function save(values: BotRoutineTaskDto) {
    const changes = {
      name: values.name === opened.name ? undefined : values.name,
      prompt: values.prompt === opened.prompt ? undefined : values.prompt,
    };
    if (changes.name === undefined && changes.prompt === undefined) {
      onClose();
      return;
    }
    update.mutate({ id: botId, routineId: routine.id, ...changes });
  }

  function askInChat() {
    fillBotDraft(botId, t('bots.settings.routines.editPrompt', { name: routine.name }));
    void navigate({ to: '/bots/$botId', params: { botId } });
  }

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent size="form" closeLabel={t('common.close')}>
        <DialogHeader>
          <DialogTitle>
            {t('bots.settings.routines.dialog.title', { name: routine.name })}
          </DialogTitle>
          <DialogDescription>{t('bots.settings.routines.dialog.description')}</DialogDescription>
        </DialogHeader>
        <DialogBody>
          <div className="flex flex-col gap-5 pb-7">
            <ErrorAlert
              error={update.error}
              fallback={t('bots.settings.routines.dialog.saveFailed')}
            />
            <div className="flex flex-col gap-1.5">
              <span className="text-sm font-medium">{t('bots.settings.routines.dialog.when')}</span>
              <span className="text-sm text-fg-muted">{routineWhen(routine, locale, t)}</span>
              <div className="flex flex-wrap items-center gap-2 text-sm text-fg-subtle">
                <span>{t('bots.settings.routines.dialog.whenHint')}</span>
                <Button type="button" variant="secondary" size="xs" onClick={askInChat}>
                  {t('bots.settings.routines.dialog.askInChat')}
                </Button>
              </div>
            </div>
            <BotRoutineForm
              routine={opened}
              isPending={update.isPending}
              onSubmit={save}
              onCancel={onClose}
            />
          </div>
        </DialogBody>
      </DialogContent>
    </Dialog>
  );
}
