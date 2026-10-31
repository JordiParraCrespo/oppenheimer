import type { BotToolStep } from '@oppenheimer/frontend-consumer';
import { Fragment } from 'react';
import { useTranslation } from 'react-i18next';
import { exploredParts } from '@/features/bots/lib/explored-steps';

/** How many things a verb names before the rest are a count. */
const SHOWN = 3;

const VERB_KEYS = {
  read: 'bots.chat.activity.exploredRead',
  list: 'bots.chat.activity.exploredList',
  search: 'bots.chat.activity.exploredSearch',
} as const;

/**
 * What a run of the bot's read-only calls looked at, after its "Explored":
 * each verb and what it named, the same thing read twice named once
 * ("Read session, mail thread · Listed hosts").
 */
export function BotExploredTargets({ steps }: { steps: readonly BotToolStep[] }) {
  const { t } = useTranslation();
  return exploredParts(steps).map(({ verb, targets }, index) => {
    const rest = targets.length - SHOWN;
    return (
      <Fragment key={verb}>
        {index > 0 ? ' · ' : null}
        {t(VERB_KEYS[verb])}
        {targets.length > 0 ? ` ${targets.slice(0, SHOWN).join(', ')}` : null}
        {rest > 0 ? ` ${t('bots.chat.activity.exploredMore', { count: rest })}` : null}
      </Fragment>
    );
  });
}
