import { Card, SuccessMark } from '@oppenheimer/design-system-web';
import { ClipboardList } from '@oppenheimer/design-system-web/icons';
import {
  useBotPendingForm,
  useDismissBotForm,
  useSubmitBotForm,
} from '@oppenheimer/frontend-consumer/react';
import { ErrorAlert } from '@oppenheimer/frontend-web';
import { useTranslation } from 'react-i18next';
import { BotFormFill } from '@/features/bots/forms/bot-form-fill';
import { useSentFlash } from '@/features/bots/hooks/use-sent-flash';

/**
 * The form a bot stopped on (`ask_form`), a card of its own beside the
 * approval and question cards, above the composer. It rises in gently; Send
 * sends every value at once and Not now declines. Once sent, the card says
 * so for a moment with a check and gives way to the compact record of what
 * was sent in the chat, where the bot carries on. A form someone else
 * settled (a second tab, a new message) is read again; a send that failed
 * keeps what was typed beside the error. It draws nothing while no form
 * waits.
 */
export function BotFormCard({ botId, name }: { botId: string; name: string }) {
  const { t } = useTranslation();
  const { data: form, refetch } = useBotPendingForm(botId);
  const { sent, flash } = useSentFlash();
  const submit = useSubmitBotForm({
    onSuccess: (card) => flash(card.title),
    onError: () => void refetch(),
  });
  const dismiss = useDismissBotForm({ onError: () => void refetch() });

  if (sent !== null && !form) {
    return (
      <Card padded role="status" className="motion-safe:animate-appear">
        <div className="flex items-center gap-3">
          <SuccessMark size="sm" label={t('bots.chat.form.sent')} />
          <div className="flex min-w-0 flex-col">
            <span className="font-medium text-fg">{t('bots.chat.form.sent')}</span>
            <span className="truncate text-sm text-fg-muted">{sent}</span>
          </div>
        </div>
      </Card>
    );
  }
  if (!form) return null;
  const failed = submit.error ?? dismiss.error;
  return (
    <Card
      key={form.id}
      padded
      role="group"
      aria-label={form.title}
      className="motion-safe:animate-appear"
    >
      <div className="flex flex-col gap-4">
        <div className="flex items-start gap-2.5">
          <ClipboardList aria-hidden className="mt-0.5 size-4 shrink-0 text-fg-muted" />
          <div className="flex min-w-0 flex-1 flex-col gap-1">
            <span className="font-medium text-fg">{form.title}</span>
            {form.spec.description ? (
              <p className="m-0 text-sm whitespace-pre-wrap break-words text-fg-muted">
                {form.spec.description}
              </p>
            ) : null}
          </div>
          <span className="shrink-0 text-xs text-fg-subtle">{name}</span>
        </div>
        <BotFormFill
          spec={form.spec}
          isPending={submit.isPending || dismiss.isPending}
          onSubmit={(values) => submit.mutate({ id: botId, formId: form.id, values })}
          onDismiss={() => dismiss.mutate({ id: botId, formId: form.id })}
        />
        <ErrorAlert
          error={failed}
          fallback={t('bots.chat.form.failed')}
          onDismiss={() => {
            submit.reset();
            dismiss.reset();
          }}
        />
      </div>
    </Card>
  );
}
