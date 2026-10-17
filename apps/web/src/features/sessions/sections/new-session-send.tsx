import {
  useCreateSession,
  useHosts,
  useHostsSnapshot,
  useProjectsSnapshot,
  useTranscribeVoice,
  useUploadSessionAttachment,
} from '@oppenheimer/frontend-consumer/react';
import { lastFailure } from '@oppenheimer/frontend-core/react';
import { ErrorAlert } from '@oppenheimer/frontend-web';
import { useNavigate, useSearch } from '@tanstack/react-router';
import { type ReactNode, useRef } from 'react';
import { useWatch } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { NewSessionComposer } from '../components/new-session-composer';
import { useAutoStart } from '../hooks/use-auto-start';
import { useDictationAvailable } from '../hooks/use-dictation-available';
import { useNewSessionDraft } from '../hooks/use-new-session-form';
import { dictationVocabulary } from '../lib/dictation-vocabulary';
import { hasPlace, toCreateInput } from '../lib/session-options';

/**
 * The composer of New session and the requests the draft makes: an upload per
 * image, then the create that names them. During render it reads only whether
 * a host is picked and paired, whether the draft names a place — one
 * repository for a new worktree, a folder for a folder session (the composer
 * cannot send without both, 05, 24) —, whether the agent needs a first task
 * (the blank terminal does not) and the request's state; the rest of
 * the draft and the projects are read once, on send, so an effort pick or a
 * projects refetch never reaches it. The chips arrive as elements so a host
 * pick, which re-renders this section, does not re-render them.
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
  const search = useSearch({ from: '/_authenticated/sessions/new' });
  const { control, getValues } = useNewSessionDraft();
  const hostId = useWatch({ control, name: 'hostId' });
  // What `start` posts, not what the picker holds, so the gate and the body agree.
  const placed = useWatch({
    control,
    name: ['where', 'scope', 'folder'],
    compute: ([where, scope, folder]) => hasPlace({ where, scope, folder }),
  });
  // The blank terminal has no agent to read a task, so it starts on nothing.
  const taskOptional = useWatch({ control, name: 'agent', compute: (agent) => agent === 'shell' });
  // Whether the picked host is still one this workspace has. A remembered host
  // that was removed since the last visit would otherwise leave send enabled
  // with an id the API refuses. A boolean, so a refetch re-renders this only
  // when the answer flips; unknown while the list loads, which does not block.
  const { data: hostKnown } = useHosts({
    select: (hosts) => hosts.some((host) => host.id === hostId),
  });
  // Needed only to send a remembered project the workspace no longer has as
  // none.
  const projects = useProjectsSnapshot();
  const hosts = useHostsSnapshot();
  const dictationAvailable = useDictationAvailable();
  const transcribe = useTranscribeVoice();

  /** A recording's text, or null when it failed: the failure is the mutation's, which the alert reads. */
  async function hear(wav: Blob): Promise<string | null> {
    try {
      const heard = await transcribe.mutateAsync({
        audio: wav,
        vocabulary: dictationVocabulary(projects(), hosts()),
      });
      return heard.text;
    } catch {
      return null;
    }
  }

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
    if (hostKnown === false || !toCreateInput(draft, { prompt, attachmentIds: [] })) return;
    create.reset();
    upload.reset();
    const attachmentIds = await attach(files);
    if (!attachmentIds) return;
    const projectId = projects()?.find((project) => project.id === draft.projectId)?.id ?? null;
    const input = toCreateInput({ ...draft, projectId }, { prompt, attachmentIds });
    if (!input) return;
    const body = JSON.stringify(input);
    if (attempt.current?.body !== body) attempt.current = { key: crypto.randomUUID(), body };
    create.mutate({ idempotencyKey: attempt.current.key, input });
  }

  useAutoStart(search.start === true, Boolean(hostId) && hostKnown === true && placed, () =>
    start('', []),
  );

  return (
    <div className="flex flex-col gap-4.5">
      <NewSessionComposer
        onSubmit={start}
        busy={upload.isPending || create.isPending}
        taskOptional={taskOptional}
        disabled={!hostId || hostKnown === false || !placed}
        scope={scope}
        tools={tools}
        engine={engine}
        dictation={
          dictationAvailable ? { transcribe: hear, transcribing: transcribe.isPending } : undefined
        }
      />

      <ErrorAlert error={lastFailure([upload, create]).error} fallback={t('sessions.new.failed')} />
      <ErrorAlert error={transcribe.error} fallback={t('sessions.new.dictation.failed')} />
    </div>
  );
}
