import { Button, CommandRow, StatusDot } from '@oppenheimer/design-system-web';
import { ExternalLink } from '@oppenheimer/design-system-web/icons';
import type { SessionEntity } from '@oppenheimer/frontend-consumer';
import { PageFrame } from '@oppenheimer/frontend-web';
import { lazy, Suspense, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { dotFor, stateWordFor } from '../lib/session-run-state';

const DeleteSessionDialog = lazy(() =>
  import('../dialogs/delete-session').then((module) => ({ default: module.DeleteSessionDialog })),
);

/**
 * A session in Claude Code's cloud, once its host has started it
 * (`product/research/cloud-agents.md` §5B). There is no terminal here: the
 * session lives on claude.ai/code, so the pane says what it is doing, opens
 * it there, and hands over the command that brings it into a terminal
 * (`claude --teleport`). Its state is what the Oppenheimer extension saw on
 * claude.ai, which is the only witness a cloud session has. Delete takes it out
 * of Oppenheimer at once; it stays on claude.ai/code.
 */
export function SessionCloud({ session }: { session: SessionEntity }) {
  const { t } = useTranslation();
  const dot = dotFor(session);
  const [deleting, setDeleting] = useState(false);

  return (
    <PageFrame size="status">
      <div>
        <p className="figures text-micro text-fg-muted uppercase">{t('sessions.cloud.eyebrow')}</p>
        <h1 className="mt-2 font-display text-h2 font-semibold text-fg">{session.name}</h1>
        <p className="mt-1.5 text-operate text-fg-muted">{session.scopeLabel}</p>

        <StatusDot state={dot} className="mt-6.5">
          {t(`sessions.session.state.${stateWordFor(session)}`)}
        </StatusDot>
        <p className="mt-1.5 text-sm text-fg-subtle">{t('sessions.cloud.statusSource')}</p>

        <div className="mt-6.5 flex items-center gap-2">
          {session.cloudUrl ? (
            <Button render={<a href={session.cloudUrl} target="_blank" rel="noreferrer" />}>
              {t('sessions.cloud.open')}
              <ExternalLink />
            </Button>
          ) : null}
          <Button variant="destructive-ghost" onClick={() => setDeleting(true)}>
            {t('sessions.cloud.delete')}
          </Button>
        </div>

        {session.teleportCommand ? (
          <CommandRow
            className="mt-6.5 max-w-140"
            lead={t('sessions.cloud.teleport')}
            command={session.teleportCommand}
            copyLabel={t('sessions.cloud.copy')}
            copiedLabel={t('sessions.cloud.copied')}
          />
        ) : null}
      </div>
      <Suspense fallback={null}>
        {deleting ? (
          <DeleteSessionDialog session={session} onClose={() => setDeleting(false)} />
        ) : null}
      </Suspense>
    </PageFrame>
  );
}
