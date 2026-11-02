import { Badge } from '@oppenheimer/design-system-web';
import { CircleAlert } from '@oppenheimer/design-system-web/icons';
import type { CiFinding, PullRequestFailingCheck } from '@oppenheimer/frontend-consumer';
import { useTranslation } from 'react-i18next';

/**
 * One check that failed on the head, in the rail: its name, linked to its
 * log, and its one-line result. When a bot looked into it
 * (`record_ci_findings`), what it found follows as a record: how the failure
 * relates to the change, whether it is a flake, what to do and how sure, then
 * the cause, the next step and the evidence it rests on.
 */
export function FailingCheck({
  check,
  finding,
}: {
  check: PullRequestFailingCheck;
  finding: CiFinding | undefined;
}) {
  const { t } = useTranslation();
  return (
    <div className="flex flex-col gap-1.5 text-sm">
      <p className="m-0 flex items-start gap-2 text-fg">
        <CircleAlert className="mt-0.5 size-4 shrink-0 text-danger" aria-hidden />
        <span className="flex min-w-0 flex-col">
          {check.url ? (
            <a
              href={check.url}
              target="_blank"
              rel="noreferrer"
              className="truncate font-medium text-fg underline-offset-4 hover:underline"
            >
              {check.name}
            </a>
          ) : (
            <span className="truncate font-medium">{check.name}</span>
          )}
          {check.title ? <span className="text-fg-muted">{check.title}</span> : null}
        </span>
      </p>
      {finding ? (
        <div className="ml-6 flex flex-col gap-1.5">
          <span className="flex flex-wrap gap-1">
            <Badge variant="neutral">
              {t(`pullRequests.detail.ci.relation.${finding.relation}`)}
            </Badge>
            <Badge variant="neutral">{t(`pullRequests.detail.ci.flake.${finding.flake}`)}</Badge>
            <Badge variant="neutral">{t(`pullRequests.detail.ci.action.${finding.action}`)}</Badge>
            <Badge variant="neutral">
              {t(`pullRequests.detail.ci.confidence.${finding.confidence}`)}
            </Badge>
          </span>
          <p className="m-0 text-fg">{finding.rootCause}</p>
          <p className="m-0 text-fg-muted">
            {t('pullRequests.detail.ci.next', { next: finding.next })}
          </p>
          <ul className="m-0 flex list-none flex-col gap-0.5 p-0 font-mono text-xs text-fg-subtle">
            {finding.evidence.map((item) => (
              <li key={item} className="break-words">
                {item}
              </li>
            ))}
          </ul>
        </div>
      ) : (
        <p className="m-0 ml-6 text-fg-subtle">{t('pullRequests.detail.ci.notLookedInto')}</p>
      )}
    </div>
  );
}
