import {
  Button,
  SettingsAddRow,
  SettingsGroup,
  SettingsListRowSkeleton,
  Skeleton,
} from '@oppenheimer/design-system-web';
import { LoadingStatus } from '@oppenheimer/frontend-web';
import { useTranslation } from 'react-i18next';
import { FactRowActionsSkeleton } from './fact-row-actions-skeleton';

/**
 * The bot's facts before they answer: the heading's line with its count still
 * a bar, Clear all as it reads with nothing to clear, then the card with
 * three facts on the row's own frame (the sentence and the meta line as
 * bars, Edit, where it is kept and forget off) and the add row's field and Add, which need no data.
 */
export function BotMemorySkeleton() {
  const { t } = useTranslation();
  return (
    <section aria-busy className="flex flex-col gap-2.5">
      <LoadingStatus />
      <div aria-hidden className="flex items-center gap-3 px-1">
        <span className="flex flex-1 items-center">
          <Skeleton shape="sm" className="h-2.5 w-16" />
        </span>
        <Button variant="destructive-ghost" size="sm" disabled tabIndex={-1}>
          {t('bots.settings.memory.clearAll')}
        </Button>
      </div>
      <SettingsGroup aria-hidden>
        {[0, 1, 2].map((index) => (
          <SettingsListRowSkeleton key={index} index={index} actions={<FactRowActionsSkeleton />} />
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
