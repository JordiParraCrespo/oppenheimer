import {
  AgentMark,
  Button,
  InboxCard,
  InboxCardActions,
  InboxCardBody,
  InboxCardFacts,
} from '@oppenheimer/design-system-web';
import type { InboxItem } from '@oppenheimer/frontend-consumer';
import { CODING_AGENTS } from '@oppenheimer/shared/agents';
import { Link } from '@tanstack/react-router';
import { useTranslation } from 'react-i18next';
import { InboxKindIcon } from '@/features/inbox/components/inbox-kind-icon';
import type { InboxCopy } from '@/features/inbox/lib/inbox-copy';
import { InboxLaterButton } from '@/features/inbox/sections/inbox-later-button';

/**
 * A session waiting on you, in the pane. Its question lives in the
 * session's own chat (§5: nothing on the server has it yet), so the answer
 * here is Open session.
 */
export function InboxSessionCard({
  item,
  copy,
  from,
  age,
}: {
  item: Extract<InboxItem, { kind: 'session' }>;
  copy: InboxCopy;
  from: string;
  age: string;
}) {
  const { t } = useTranslation();
  const { session } = item;

  return (
    <InboxCard icon={<InboxKindIcon kind="session" />} from={from} title={copy.title} age={age}>
      <InboxCardBody>{copy.body}</InboxCardBody>
      <InboxCardFacts>
        <span className="flex items-center gap-1.5 [&_svg]:size-3.5">
          <AgentMark agent={session.agent} />
          {CODING_AGENTS[session.agent].label}
        </span>
        {session.scopeLabel ? <span className="font-mono">{session.scopeLabel}</span> : null}
      </InboxCardFacts>
      <InboxCardActions leading={<InboxLaterButton itemKey={item.key} />}>
        <Button render={<Link to="/sessions/$sessionId" params={{ sessionId: session.id }} />}>
          {t('inbox.session.open')}
        </Button>
      </InboxCardActions>
    </InboxCard>
  );
}
