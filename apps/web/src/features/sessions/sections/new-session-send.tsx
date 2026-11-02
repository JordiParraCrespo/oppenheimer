import type { StartCloudSessionInput } from '@oppenheimer/frontend-consumer';
import {
  useCloudAgentStatus,
  useCreateSession,
  useHosts,
  useHostsSnapshot,
  useProjectsSnapshot,
  useStartCloudSession,
  useUploadSessionAttachment,
  useVoiceDictation,
} from '@oppenheimer/frontend-consumer/react';
import { lastFailure } from '@oppenheimer/frontend-core/react';
import { ErrorAlert } from '@oppenheimer/frontend-web';
import { useNavigate, useSearch } from '@tanstack/react-router';
import { type ReactNode, useRef, useState } from 'react';
import { useWatch } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { CloudLaunchAlert } from '../components/cloud-launch-alert';
import { NewSessionComposer } from '../components/new-session-composer';
import { useAutoStart } from '../hooks/use-auto-start';
import { useNewSessionDraft } from '../hooks/use-new-session-form';
import { cloudLaunchFailure } from '../lib/cloud-launch-failure';
import { dictationVocabulary } from '../lib/dictation-vocabulary';
import { hasPlace, toCreateInput, toStartCloudInput } from '../lib/session-options';

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
  // A vendor picked: the session is launched there, with no host.
  const cloudProvider = useWatch({ control, name: 'cloudProvider' });
  const atVendor = cloudProvider !== null;
  // Whether the reader holds a key for the vendor picked: without one, send
  // stays off, and the place chip's Cloud row says to connect it.
  const { data: cloudConnected } = useCloudAgentStatus();
  const vendor = cloudConnected?.providers.find((provider) => provider.id === cloudProvider);
  const connected = vendor?.connected ?? false;
  // What `start` posts, not what the picker holds, so the gate and the body agree.
  const placed = useWatch({
    control,
    name: ['where', 'scope', 'folder'],
    compute: ([where, scope, folder]) => hasPlace({ where, scope, folder }),
  });
  // The blank terminal has no agent to read a task, so it starts on nothing;
  // a vendor's agent always does.
  const taskOptional = useWatch({
    control,
    name: ['agent', 'where'],
    compute: ([agent, where]) => agent === 'shell' && where !== 'cloud',
  });
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
  const voice = useVoiceDictation(() => dictationVocabulary(projects(), hosts()));

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
  const startCloud = useStartCloudSession();
  const lastCloudLaunch = useRef<StartCloudSessionInput | null>(null);
  // Files ride a host session's first task; a vendor's agent takes none, and
  // a file is never dropped without a word.
  const [filesRefused, setFilesRefused] = useState(false);

  /**
   * Launches `input` at its vendor. It is kept as the last launch, so Try
   * again sends this very request — its task, its repository and its key —
   * whatever the chips hold by then.
   */
  function launchInCloud(input: StartCloudSessionInput) {
    const body = JSON.stringify(input);
    if (attempt.current?.body !== body) attempt.current = { key: crypto.randomUUID(), body };
    lastCloudLaunch.current = input;
    const tab = window.open('', '_blank');
    startCloud.reset();
    startCloud.mutate(
      { idempotencyKey: attempt.current.key, input },
      {
        onSuccess: (session) => {
          attempt.current = null;
          if (tab && session.cloud?.url) {
            tab.opener = null;
            tab.location.href = session.cloud.url;
          } else {
            tab?.close();
          }
          navigate({ to: '/sessions/$sessionId', params: { sessionId: session.id } });
        },
        onError: () => tab?.close(),
      },
    );
  }

  /**
   * A cloud session opens at its vendor, in a tab of its own, as
   * `SessionsConsole.dc.html` draws it. The tab is opened in the press itself,
   * so no browser blocks it, and pointed at the vendor's page once the session
   * exists; the console goes to the session, as for any start.
   */
  function sendToCloud(prompt: string, files: File[]) {
    const draft = getValues();
    const projectId = projects()?.find((project) => project.id === draft.projectId)?.id ?? null;
    const input = toStartCloudInput({ ...draft, projectId }, prompt);
    setFilesRefused(files.length > 0);
    if (!input || files.length > 0) return;
    launchInCloud(input);
  }

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
    if (getValues('cloudProvider')) {
      sendToCloud(prompt, files);
      return;
    }
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

  useAutoStart(
    search.start === true,
    !atVendor && Boolean(hostId) && hostKnown === true && placed,
    () => start('', []),
  );

  const failure = lastFailure([upload, create, startCloud]);
  // The launch at a vendor says what fixes it; any other failure keeps the generic alert.
  const cloudFailure =
    failure.error && failure.error === startCloud.error
      ? cloudLaunchFailure(startCloud.error)
      : null;

  return (
    <div className="flex flex-col gap-4.5">
      <NewSessionComposer
        onSubmit={start}
        busy={upload.isPending || create.isPending || startCloud.isPending}
        taskOptional={taskOptional}
        disabled={atVendor ? !connected || !placed : !hostId || hostKnown === false || !placed}
        scope={scope}
        tools={tools}
        engine={engine}
        voice={voice}
      />

      <ErrorAlert
        message={atVendor && filesRefused ? t('sessions.new.cloudNoFiles') : null}
        onDismiss={() => setFilesRefused(false)}
      />
      {cloudFailure ? (
        <CloudLaunchAlert
          failure={cloudFailure}
          vendor={vendor?.label ?? t('sessions.new.cloudFailure.vendor')}
          // In a tab of its own: leaving New session would drop the task typed here.
          onConnect={() => window.open('/settings/cloud-agents', '_blank', 'noopener')}
          onRetry={() => lastCloudLaunch.current && launchInCloud(lastCloudLaunch.current)}
          onDismiss={() => startCloud.reset()}
        />
      ) : (
        <ErrorAlert error={failure.error} fallback={t('sessions.new.failed')} />
      )}
    </div>
  );
}
