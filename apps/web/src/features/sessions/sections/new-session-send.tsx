import { Alert, AlertDescription } from '@oppenheimer/design-system-web';
import {
  useCreateSession,
  useHosts,
  useProjectsSnapshot,
} from '@oppenheimer/frontend-consumer/react';
import { useErrorMessage } from '@oppenheimer/frontend-core/react';
import { useNavigate } from '@tanstack/react-router';
import { type ReactNode, useRef } from 'react';
import { useWatch } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { NewSessionComposer } from '../components/new-session-composer';
import { useNewSessionDraft } from '../hooks/use-new-session-form';
import { toCheckouts, toLaunchInput } from '../lib/session-options';

/**
 * The composer of New session, and the one request the draft makes.
 *
 * What this section reads during render is only what it must: whether a host
 * is picked and still paired, and whether a repository is picked, because the
 * composer cannot send without either, and the request's state. The rest of the draft, and the projects, are read once, when the task
 * is sent — so a pick of effort or a refetch of the projects never reaches it.
 *
 * `scope`, `tools` and `engine` are the chips, built by the section above and
 * placed here untouched. They arrive as elements rather than being built here
 * so that picking a host, which re-renders this section, does not re-render
 * them.
 */
export function NewSessionSend({
  scope,
  tools,
  engine,
}: {
  scope: ReactNode;
  tools: ReactNode;
  engine: ReactNode;
}) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const resolveError = useErrorMessage();
  const { control, getValues } = useNewSessionDraft();
  const hostId = useWatch({ control, name: 'hostId' });
  // Whether a repository is picked. A runner makes a session as one worktree of
  // one repository, so a session sent with none is recorded and then fails on
  // the host ("This host makes sessions with one repository"). The composer
  // stays disabled until one is picked instead. A boolean, so picking a second
  // branch or swapping repositories does not re-render this section.
  const hasRepository = useWatch({
    control,
    name: 'scope',
    compute: (scope) => scope.length > 0,
  });
  // Whether the picked host is still one this workspace has. A remembered host
  // that was removed since the last visit would otherwise leave send enabled
  // with an id the API refuses. A boolean, so a refetch re-renders this only
  // when the answer flips; unknown while the list loads, which does not block.
  const { data: hostKnown } = useHosts({
    select: (hosts) => hosts.some((host) => host.id === hostId),
  });
  // Read at send time, not subscribed to: the list is only needed to send a
  // remembered project the workspace no longer has as none, and a subscription
  // would re-render the composer on every refetch of a list it never draws.
  const projects = useProjectsSnapshot();

  /**
   * The key that makes a second press of send safe, and the request it was
   * minted for.
   *
   * The same request sent again reuses its key: if the first response was lost,
   * the retry returns the session that request already made rather than
   * building a second worktree and a second branch. A *different* request — the
   * host or the repository changed after a failure — gets a key of its own, or
   * the API would answer it with the session the first one made.
   */
  const attempt = useRef<{ key: string; body: string } | null>(null);
  const create = useCreateSession({
    onSuccess: (session) => {
      attempt.current = null;
      navigate({ to: '/sessions/$sessionId', params: { sessionId: session.id } });
    },
  });

  function start(prompt: string) {
    const draft = getValues();
    if (!draft.hostId || hostKnown === false || draft.scope.length === 0) return;
    const projectId = projects()?.find((project) => project.id === draft.projectId)?.id ?? null;
    const input = {
      hostId: draft.hostId,
      agent: draft.agent,
      ...(projectId ? { projectId } : {}),
      checkouts: toCheckouts(draft.scope),
      launch: toLaunchInput(draft),
      prompt,
    };
    const body = JSON.stringify(input);
    if (attempt.current?.body !== body) attempt.current = { key: crypto.randomUUID(), body };
    create.mutate({ idempotencyKey: attempt.current.key, input });
  }

  return (
    <div className="flex flex-col gap-4.5">
      <NewSessionComposer
        onSubmit={start}
        busy={create.isPending}
        disabled={!hostId || hostKnown === false || !hasRepository}
        scope={scope}
        tools={tools}
        engine={engine}
      />

      {create.isError ? (
        <Alert variant="destructive">
          <AlertDescription>
            {resolveError(create.error, t('sessions.new.failed')).message}
          </AlertDescription>
        </Alert>
      ) : null}
    </div>
  );
}
