import { Button, ChipSelect } from '@oppenheimer/design-system-web';
import { Cpu } from '@oppenheimer/design-system-web/icons';
import type { SessionEntity } from '@oppenheimer/frontend-consumer';
import { useCreateSession, useHosts } from '@oppenheimer/frontend-consumer/react';
import { ErrorAlert } from '@oppenheimer/frontend-web';
import { useNavigate } from '@tanstack/react-router';
import { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { continueHost } from '../lib/cloud-continue';

/**
 * Continue a Claude Code cloud session on one of your hosts: a worktree
 * session there whose agent opens the cloud session's branch and history
 * (`claude --teleport`), so the work goes on in a terminal of ours. The chip
 * starts on the host that started it while it is online, else the first
 * online one; picking another is the chip's. A press opens the new session.
 *
 * The idempotency key belongs to one host's attempt, as New session's does,
 * and outlives a failure: a second press after a lost answer returns the
 * session already made rather than a second worktree, and a refused one
 * wrote nothing for the key to find. A press on another host is a new one.
 */
export function SessionCloudContinue({ session }: { session: SessionEntity }) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [picked, setPicked] = useState<string | null>(null);
  const attempt = useRef<{ hostId: string; key: string } | null>(null);
  const hosts = useHosts();
  const create = useCreateSession({
    onSuccess: (created) => {
      attempt.current = null;
      navigate({ to: '/sessions/$sessionId', params: { sessionId: created.id } });
    },
  });
  const list = hosts.data ?? [];
  const hostId =
    (picked && list.some((host) => host.id === picked) ? picked : null) ??
    continueHost(list, session.hostId)?.id ??
    null;

  const start = () => {
    const input = hostId ? session.continueOn(hostId) : null;
    if (!hostId || !input) return;
    if (attempt.current?.hostId !== hostId) attempt.current = { hostId, key: crypto.randomUUID() };
    create.mutate({ input, idempotencyKey: attempt.current.key });
  };

  return (
    <section className="mt-6.5 max-w-140" aria-labelledby="cloud-continue-title">
      <h2 id="cloud-continue-title" className="text-operate font-semibold text-fg">
        {t('sessions.cloud.continue.title')}
      </h2>
      <p className="mt-1 text-sm text-fg-muted">
        {hosts.data && !hostId
          ? t('sessions.cloud.continue.noHost')
          : t('sessions.cloud.continue.description')}
      </p>
      <ErrorAlert
        className="mt-3"
        error={create.error}
        fallback={t('sessions.cloud.continue.failed')}
      />
      <div className="mt-3 flex flex-wrap items-center gap-2">
        {list.length > 0 ? (
          <ChipSelect
            value={hostId}
            onValueChange={setPicked}
            options={list.map((host) => ({
              value: host.id,
              label: host.name,
              description: host.online
                ? host.summary
                : `${host.summary} · ${t('sessions.cloud.continue.offline')}`,
              keywords: host.hostname ?? undefined,
              disabled: !host.online,
            }))}
            icon={<Cpu />}
            loading={hosts.isPending}
            aria-label={t('sessions.cloud.continue.host')}
            placeholder={t('sessions.cloud.continue.host')}
            searchPlaceholder={t('sessions.cloud.continue.search')}
            emptyText={t('sessions.cloud.continue.empty')}
          />
        ) : null}
        <Button
          disabled={!hostId}
          pending={create.isPending}
          pendingLabel={t('sessions.cloud.continue.starting')}
          onClick={start}
        >
          {t('sessions.cloud.continue.start')}
        </Button>
      </div>
    </section>
  );
}
