import {
  Button,
  SettingsAddRow,
  SettingsGroup,
  SettingsListRow,
  Skeleton,
} from '@oppenheimer/design-system-web';
import { useTranslation } from 'react-i18next';

/** Three facts, a sentence and who wrote it when, at the widths remembered facts run to. */
const FACTS = [
  { fact: 'w-64', meta: 'w-36' },
  { fact: 'w-80', meta: 'w-32' },
  { fact: 'w-52', meta: 'w-36' },
];

/**
 * The bot's facts before they answer: the heading's line with its count still
 * a bar, Clear all as it reads with nothing to clear, then the card with
 * three facts on the row's own frame (the sentence, the meta line, Edit and
 * forget as bars) and the add row's field and Add, which need no data.
 */
export function BotMemorySkeleton() {
  const { t } = useTranslation();
  return (
    <section aria-busy className="flex flex-col gap-2.5">
      <span role="status" className="sr-only">
        {t('common.loading')}
      </span>
      <div aria-hidden className="flex items-center gap-3 px-1">
        <span className="flex flex-1 items-center">
          <Skeleton shape="sm" className="h-2.5 w-16" />
        </span>
        <Button variant="destructive-ghost" size="sm" disabled tabIndex={-1}>
          {t('bots.settings.memory.clearAll')}
        </Button>
      </div>
      <SettingsGroup aria-hidden>
        {FACTS.map(({ fact, meta }) => (
          <SettingsListRow
            key={fact}
            meta={
              <span className="flex h-4.5 items-center">
                <Skeleton shape="sm" className={`h-2.5 ${meta}`} />
              </span>
            }
            actions={
              <>
                <Skeleton shape="pill" className="h-7 w-12" />
                <Skeleton shape="pill" className="size-7" />
              </>
            }
          >
            <span className="flex h-5 items-center">
              <Skeleton shape="sm" className={`h-3 ${fact}`} />
            </span>
          </SettingsListRow>
        ))}
        <div inert>
          <SettingsAddRow
            value=""
            onValueChange={() => {}}
            onAdd={() => {}}
            canAdd={false}
            placeholder={t('bots.settings.memory.addPlaceholder')}
            addLabel={t('bots.settings.memory.add')}
            aria-label={t('bots.settings.memory.newFact')}
          />
        </div>
      </SettingsGroup>
    </section>
  );
}
