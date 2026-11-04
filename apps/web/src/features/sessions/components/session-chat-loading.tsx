import { AgentMark, Skeleton } from '@oppenheimer/design-system-web';
import { type SessionAgent, sessionAgentLabel } from '@oppenheimer/frontend-consumer';
import { useTranslation } from 'react-i18next';
import { SessionStatusHead } from './session-status-head';

/**
 * The chat while its history arrives: the provisioning pane's head at its
 * width (420px), led by the agent's mark breathing in its disc and the title
 * swept like the chat's own "Working…", over a faint ghost of the turns to
 * come, fading as it goes down. Every motion is `motion-safe`; the ghost is
 * hidden from assistive technology, which hears the title once.
 */
export function SessionChatLoading({ agent }: { agent: SessionAgent | null }) {
  const { t } = useTranslation();
  return (
    <div aria-busy role="status" className="flex flex-1 flex-col justify-center gap-12 py-8">
      <div className="w-full max-w-105 self-center">
        {agent ? (
          <span className="relative mb-5 flex size-11 items-center justify-center">
            <span className="absolute inset-0 rounded-pill bg-control motion-safe:animate-pulse-dot" />
            <AgentMark agent={agent} className="relative size-5" />
          </span>
        ) : null}
        <SessionStatusHead
          eyebrow={agent ? sessionAgentLabel(agent) : undefined}
          title={
            <span className="motion-safe:animate-shimmer">{t('sessions.chat.loading.title')}</span>
          }
          lead={t('sessions.chat.loading.lead')}
        />
      </div>

      <div aria-hidden className="flex flex-col gap-6">
        <div className="flex justify-end opacity-80">
          <Skeleton shape="lg" className="h-11 w-60" />
        </div>
        <div className="flex flex-col gap-2.5 opacity-60">
          <Skeleton shape="sm" className="h-3 w-11/12" />
          <Skeleton shape="sm" className="h-3 w-full" />
          <Skeleton shape="sm" className="h-3 w-3/5" />
        </div>
        <div className="flex justify-end opacity-40">
          <Skeleton shape="lg" className="h-11 w-44" />
        </div>
        <div className="flex flex-col gap-2.5 opacity-20">
          <Skeleton shape="sm" className="h-3 w-4/5" />
          <Skeleton shape="sm" className="h-3 w-2/3" />
        </div>
      </div>
    </div>
  );
}
