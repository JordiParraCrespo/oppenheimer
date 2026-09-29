import type { CreateSessionInput } from '@oppenheimer/frontend-consumer';
import {
  useCreateSession,
  useHosts,
  useProjectsSnapshot,
  useUploadSessionAttachment,
} from '@oppenheimer/frontend-consumer/react';
import { lastFailure } from '@oppenheimer/frontend-core/react';
import { ErrorAlert } from '@oppenheimer/frontend-web';
import { useNavigate } from '@tanstack/react-router';
import { type ReactNode, useRef } from 'react';
import { useWatch } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { NewSessionComposer } from '../components/new-session-composer';
import { useNewSessionDraft } from '../hooks/use-new-session-form';
import { toCheckouts, toLaunchInput } from '../lib/session-options';

/**
 * The composer of New session, and the requests the draft makes: an upload
 * per attached image, then the create that names them.
 *
 * What this section reads during render is only what it must: whether a host
 * is picked and still paired, and whether the pick names one repository the
 * request can carry — the composer cannot send without both (05) — and the
 * request's state. The rest of the draft, and the projects, are read once,
 * when the task is sent — so a pick of effort or a refetch of the projects
 * never reaches it.
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
  const { control, getValues } = useNewSessionDraft();
  const hostId = useWatch({ control, name: 'hostId' });
  // What `start` posts, not what the picker holds, so the gate and the body agree.
  const hasCheckout = useWatch({
    control,
    name: 'scope',
    compute: (picked) => toCheckouts(picked).length > 0,
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
  const upload = useUploadSessionAttachment();
  const create = useCreateSession({
    onSuccess: (session) => {
      attempt.current = null;
      navigate({ to: '/sessions/$sessionId', params: { sessionId: session.id } });
    },
  });

  /**
   * Each file's upload id, all uploaded at once; null when one failed. The API
   * names an upload by its owner and its bytes, so sending the same files again
   * answers the same ids — the same body, so the same key — and a second press
   * of send, or two in one frame, is the create the first one was.
   */
  async function attach(files: File[]): Promise<string[] | null> {
    try {
      return await Promise.all(files.map(async (file) => (await upload.mutateAsync(file)).id));
    } catch {
      // The failure is the mutation's error, which the alert below reads.
      return null;
    }
  }

  async function start(prompt: string, files: File[]) {
    const draft = getValues();
    const [checkout] = toCheckouts(draft.scope);
    if (!draft.hostId || hostKnown === false || !checkout) return;
    create.reset();
    upload.reset();
    const attachmentIds = await attach(files);
    if (!attachmentIds) return;
    const projectId = projects()?.find((project) => project.id === draft.projectId)?.id ?? null;
    const input: CreateSessionInput = {
      hostId: draft.hostId,
      agent: draft.agent,
      ...(projectId ? { projectId } : {}),
      checkouts: [checkout],
      launch: toLaunchInput(draft),
      prompt,
      ...(attachmentIds.length > 0 ? { attachmentIds } : {}),
    };
    const body = JSON.stringify(input);
    if (attempt.current?.body !== body) attempt.current = { key: crypto.randomUUID(), body };
    create.mutate({ idempotencyKey: attempt.current.key, input });
  }

  return (
    <div className="flex flex-col gap-4.5">
      <NewSessionComposer
        onSubmit={start}
        busy={upload.isPending || create.isPending}
        disabled={!hostId || hostKnown === false || !hasCheckout}
        scope={scope}
        tools={tools}
        engine={engine}
      />

      <ErrorAlert error={lastFailure([upload, create]).error} fallback={t('sessions.new.failed')} />
    </div>
  );
}
