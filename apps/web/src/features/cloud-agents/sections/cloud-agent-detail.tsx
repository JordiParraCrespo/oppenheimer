import {
  Button,
  Callout,
  PageHeaderMeta,
  PageHeaderRow,
  Prose,
  SummaryCard,
  SummaryRow,
} from '@oppenheimer/design-system-web';
import { ExternalLink } from '@oppenheimer/design-system-web/icons';
import { useSuspenseCloudAgent } from '@oppenheimer/frontend-consumer/react';
import { ErrorAlert, Markdown, RelativeTime } from '@oppenheimer/frontend-web';
import { CLOUD_AGENT_PROVIDER_LABELS } from '@oppenheimer/shared/schemas/cloud-agent';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { CloudAgentStatusDot } from '../components/cloud-agent-status';
import { StopCloudAgentDialog } from '../dialogs/stop-cloud-agent';
import { CloudAgentFollowUp } from './cloud-agent-follow-up';

/**
 * One cloud agent: its name and where its run stands, Stop while it works and
 * the vendor's own page; the repository, model, branch and pull request; what
 * it was asked and its last reply; then the next instruction. The read polls
 * while the agent works, and every part of the page is that one agent.
 */
export function CloudAgentDetail({ agentId }: { agentId: string }) {
  const { t } = useTranslation();
  const { data: agent, error } = useSuspenseCloudAgent(agentId);
  const [stopping, setStopping] = useState(false);
  const provider = CLOUD_AGENT_PROVIDER_LABELS[agent.provider];

  return (
    <div className="flex flex-col gap-6">
      <PageHeaderRow
        title={agent.name}
        meta={
          <PageHeaderMeta indent={false}>
            <CloudAgentStatusDot status={agent.status} />
            <RelativeTime date={agent.syncedAt}>
              {(age) => (
                <span className="text-fg-subtle">
                  {t('sessions.cloudAgents.detail.lastHeard', {
                    provider,
                    age: age ?? t('sessions.cloudAgents.detail.justNow'),
                  })}
                </span>
              )}
            </RelativeTime>
          </PageHeaderMeta>
        }
        actions={
          <>
            {agent.isActive ? (
              <Button variant="secondary" size="sm" onClick={() => setStopping(true)}>
                {t('sessions.cloudAgents.detail.stop')}
              </Button>
            ) : null}
            {agent.url ? (
              <Button
                variant="ghost"
                size="sm"
                render={<a href={agent.url} target="_blank" rel="noreferrer" />}
              >
                {t('sessions.cloudAgents.detail.openAt', { provider })}
                <ExternalLink />
              </Button>
            ) : null}
          </>
        }
      />
      <ErrorAlert error={error} fallback={t('sessions.cloudAgents.detail.loadFailed')} />
      {agent.isActive ? (
        <Callout>{t('sessions.cloudAgents.detail.working', { provider })}</Callout>
      ) : null}
      <SummaryCard>
        <SummaryRow label={t('sessions.cloudAgents.detail.repository')}>
          {agent.repositoryName}
          {agent.startingRef ? ` @ ${agent.startingRef}` : ''}
        </SummaryRow>
        <SummaryRow label={t('sessions.cloudAgents.detail.model')}>
          {agent.model ?? t('sessions.cloudAgents.detail.modelDefault')}
        </SummaryRow>
        <SummaryRow label={t('sessions.cloudAgents.detail.branch')}>
          {agent.branch ?? t('sessions.cloudAgents.detail.branchPending')}
        </SummaryRow>
        {agent.pullRequestUrl ? (
          <SummaryRow label={t('sessions.cloudAgents.detail.pullRequest')} mono={false}>
            <a className="text-link" href={agent.pullRequestUrl} target="_blank" rel="noreferrer">
              {t('sessions.cloudAgents.detail.openPullRequest')}
            </a>
          </SummaryRow>
        ) : null}
      </SummaryCard>
      <section className="flex flex-col gap-2">
        <h2 className="eyebrow m-0">{t('sessions.cloudAgents.detail.prompt')}</h2>
        <p className="m-0 whitespace-pre-wrap text-fg">{agent.prompt}</p>
      </section>
      {agent.summary ? (
        <section className="flex flex-col gap-2">
          <h2 className="eyebrow m-0">{t('sessions.cloudAgents.detail.reply')}</h2>
          <Prose>
            <Markdown source={agent.summary} />
          </Prose>
        </section>
      ) : null}
      <CloudAgentFollowUp agentId={agent.id} working={agent.isActive} />
      {stopping ? (
        <StopCloudAgentDialog
          agentId={agent.id}
          name={agent.name}
          onClose={() => setStopping(false)}
        />
      ) : null}
    </div>
  );
}
