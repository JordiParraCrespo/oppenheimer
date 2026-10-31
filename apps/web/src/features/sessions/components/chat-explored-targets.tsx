import type { ChatToolCall } from '@oppenheimer/frontend-consumer';
import { Fragment } from 'react';
import { useTranslation } from 'react-i18next';
import { exploredParts } from '../lib/explored';

/** How many targets a verb names before the rest are a count. */
const SHOWN = 4;

/**
 * What a run of exploring calls looked at, in a line after its "Explored":
 * each verb with its targets in mono, a file read twice named once, a long
 * list cut to its first few and a count ("Read a.ts, b.ts · Searched foo").
 */
export function ChatExploredTargets({ calls }: { calls: readonly ChatToolCall[] }) {
  const { t } = useTranslation();
  return exploredParts(calls).map(({ verb, targets }, index) => {
    const rest = targets.length - SHOWN;
    return (
      <Fragment key={verb}>
        {index > 0 ? ' · ' : null}
        {t(`sessions.chat.explored.${verb}`)}{' '}
        <span className="font-mono">{targets.slice(0, SHOWN).join(', ')}</span>
        {rest > 0 ? ` ${t('sessions.chat.explored.more', { count: rest })}` : null}
      </Fragment>
    );
  });
}
