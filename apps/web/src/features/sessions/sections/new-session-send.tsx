import { useCreateSession, useProjectsSnapshot } from '@oppenheimer/frontend-consumer/react';
import { useNavigate } from '@tanstack/react-router';
import { type ReactNode, useRef } from 'react';
import { useWatch } from 'react-hook-form';
import { NewSessionComposer } from '../components/new-session-composer';
import { useNewSessionDraft } from '../hooks/use-new-session-form';
import { toCheckouts, toLaunchInput } from '../lib/session-options';

/**
 * The composer of New session, and the one request the draft makes.
 *
 * What this section reads during render is only what it must: whether a host
 * is picked, because the composer cannot send without one, and the request's
 * state. The rest of the draft, and the projects, are read once, when the task
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
  const navigate = useNavigate();
  const { control, getValues } = useNewSessionDraft();
  const hostId = useWatch({ control, name: 'hostId' });
  // Read at send time, not subscribed to: the list is only needed to send a
  // remembered project the workspace no longer has as none, and a subscription
  // would re-render the composer on every refetch of a list it never draws.
  const projects = useProjectsSnapshot();

  /**
   * The key that makes a second press of send safe.
   *
   * It is minted once per draft and kept until a session is created: if the
   * first response was lost, the retry returns the session that request already
   * made rather than building a second worktree and a second branch.
   */
  const idempotencyKey = useRef(crypto.randomUUID());
  const create = useCreateSession({
    onSuccess: (session) => {
      idempotencyKey.current = crypto.randomUUID();
      navigate({ to: '/sessions/$sessionId', params: { sessionId: session.id } });
    },
  });

  function start(prompt: string) {
    const draft = getValues();
    if (!draft.hostId) return;
    const projectId = projects()?.find((project) => project.id === draft.projectId)?.id ?? null;
    create.mutate({
      idempotencyKey: idempotencyKey.current,
      input: {
        hostId: draft.hostId,
        agent: draft.agent,
        ...(projectId ? { projectId } : {}),
        checkouts: toCheckouts(draft.scope),
        launch: toLaunchInput(draft),
        prompt,
      },
    });
  }

  return (
    <div className="flex flex-col gap-4.5">
      <NewSessionComposer
        onSubmit={start}
        busy={create.isPending}
        disabled={!hostId}
        scope={scope}
        tools={tools}
        engine={engine}
      />

      {create.isError ? (
        <p role="alert" className="text-sm text-danger">
          {create.error.message}
        </p>
      ) : null}
    </div>
  );
}
