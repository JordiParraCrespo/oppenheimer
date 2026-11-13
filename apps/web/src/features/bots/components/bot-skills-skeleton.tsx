import {
  Button,
  SettingsGroup,
  SettingsListRowSkeleton,
  Skeleton,
} from '@oppenheimer/design-system-web';
import { LoadingStatus } from '@oppenheimer/frontend-web';
import { useTranslation } from 'react-i18next';

/**
 * The bot's skills before they answer: the heading's line with its count a
 * bar and Add skill as it reads, then the card with two skills on the row's
 * own frame (the command and description, the meta line, edit and delete);
 * under it the built-in group, its count a bar and its hint as it reads,
 * over two rows with the one view button each.
 */
export function BotSkillsSkeleton() {
  const { t } = useTranslation();
  return (
    <div aria-busy className="flex flex-col gap-8">
      <LoadingStatus />
      <section className="flex flex-col gap-2.5">
        <div aria-hidden className="flex items-center gap-3 px-1">
          <span className="flex flex-1 items-center">
            <Skeleton shape="sm" className="h-2.5 w-16" />
          </span>
          <Button variant="secondary" size="sm" disabled tabIndex={-1}>
            {t('bots.settings.skills.add')}
          </Button>
        </div>
        <SettingsGroup aria-hidden>
          {[0, 1].map((index) => (
            <SettingsListRowSkeleton
              key={index}
              index={index}
              actions={
                <>
                  <Skeleton shape="pill" className="size-7" />
                  <Skeleton shape="pill" className="size-7" />
                </>
              }
            />
          ))}
        </SettingsGroup>
      </section>
      <section aria-hidden className="flex flex-col gap-2.5">
        <div className="flex flex-col gap-1 px-1">
          <span className="flex h-4.5 items-center">
            <Skeleton shape="sm" className="h-2.5 w-20" />
          </span>
          <p className="m-0 text-[12.5px] text-fg-subtle">
            {t('bots.settings.skills.builtIn.hint')}
          </p>
        </div>
        <SettingsGroup>
          {[2, 0].map((index) => (
            <SettingsListRowSkeleton
              key={index}
              index={index}
              actions={<Skeleton shape="pill" className="size-7" />}
            />
          ))}
        </SettingsGroup>
      </section>
    </div>
  );
}
