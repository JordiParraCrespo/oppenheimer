import {
  Button,
  InboxCard,
  InboxCardActions,
  InboxCardBody,
  InboxCardFacts,
} from '@oppenheimer/design-system-web';
import type { InboxItem } from '@oppenheimer/frontend-consumer';
import { usePutInboxMark, useRunAutomation } from '@oppenheimer/frontend-consumer/react';
import { ErrorAlert } from '@oppenheimer/frontend-web';
import { Link } from '@tanstack/react-router';
import { useTranslation } from 'react-i18next';
import { InboxKindIcon } from '@/features/inbox/components/inbox-kind-icon';
import type { InboxCopy } from '@/features/inbox/lib/inbox-copy';
import { inboxVisit } from '@/features/inbox/lib/inbox-visit';
import { InboxLaterButton } from '@/features/inbox/sections/inbox-later-button';

/**
 * A failed run in the pane: its failure line, its exit code when the turn
 * gave one, Run again (a new run of the automation, `POST
 * /automations/:id/run`) and Open run. The failed run stays failed for the
 * day it shows, so running again also marks it done. A bot's routine or a
 * deleted automation is read here, and the card says where it is answered.
 */
export function InboxRunCard({
  item,
  copy,
  from,
  age,
}: {
  item: Extract<InboxItem, { kind: 'run' }>;
  copy: InboxCopy;
  from: string;
  age: string;
}) {
  const { t } = useTranslation();
  const runAgain = useRunAutomation();
  const mark = usePutInboxMark();
  const { run } = item;
  // A bot's routine (no agent) lives on its bot's page, which the run does not name.
  const isAutomation = !run.automationDeleted && run.agent !== null;
  const exitCode = run.turn?.exitCode ?? null;

  return (
    <InboxCard icon={<InboxKindIcon kind="run" />} from={from} title={copy.title} age={age}>
      <InboxCardBody>{copy.body}</InboxCardBody>
      <InboxCardFacts>
        <span>{run.title}</span>
        <span>{run.causeSummary.text}</span>
        {exitCode !== null ? (
          <span className="font-mono">{t('inbox.run.exit', { code: exitCode })}</span>
        ) : null}
      </InboxCardFacts>
      {isAutomation ? null : (
        <p className="text-xs text-fg-subtle">
          {t(run.automationDeleted ? 'inbox.run.deletedHint' : 'inbox.run.routineHint')}
        </p>
      )}
      {runAgain.error ? (
        <ErrorAlert
          error={runAgain.error}
          fallback={t('inbox.card.answerFailed')}
          onDismiss={runAgain.reset}
        />
      ) : null}
      <InboxCardActions
        leading={
          <>
            <InboxLaterButton itemKey={item.key} />
            {isAutomation ? (
              <Button
                variant="secondary"
                render={
                  run.sessionId ? (
                    <Link
                      to="/automations/$automationId/sessions/$sessionId"
                      params={{ automationId: run.automationId, sessionId: run.sessionId }}
                    />
                  ) : (
                    <Link
                      to="/automations/$automationId"
                      params={{ automationId: run.automationId }}
                    />
                  )
                }
              >
                {t('inbox.run.open')}
              </Button>
            ) : null}
          </>
        }
      >
        {isAutomation ? (
          <Button
            disabled={runAgain.isPending}
            onClick={() =>
              runAgain.mutate(
                { id: run.automationId, idempotencyKey: crypto.randomUUID() },
                {
                  onSuccess: () => {
                    mark.mutate({ itemKey: item.key, mark: 'done' });
                    inboxVisit.answered(item.key);
                    inboxVisit.log(t('inbox.log.ranAgain', { name: run.automationName }));
                  },
                },
              )
            }
          >
            {t('inbox.run.again')}
          </Button>
        ) : null}
      </InboxCardActions>
    </InboxCard>
  );
}
