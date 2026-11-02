import { Button, SettingsGroup, SettingsListRow, Skeleton } from '@oppenheimer/design-system-web';
import { LoadingStatus } from '@oppenheimer/frontend-web';
import { useTranslation } from 'react-i18next';

/** Two skills, a command and its description, at the widths they run to. */
const SKILLS = [
  { line: 'w-72', meta: 'w-36' },
  { line: 'w-56', meta: 'w-32' },
];

/**
 * The bot's skills before they answer: the heading's line with its count a
 * bar and Add skill as it reads, then the card with two skills on the row's
 * own frame (the command and description, the meta line, edit and delete).
 */
export function BotSkillsSkeleton() {
  const { t } = useTranslation();
  return (
    <section aria-busy className="flex flex-col gap-2.5">
      <LoadingStatus />
      <div aria-hidden className="flex items-center gap-3 px-1">
        <span className="flex flex-1 items-center">
          <Skeleton shape="sm" className="h-2.5 w-16" />
        </span>
        <Button variant="secondary" size="sm" disabled tabIndex={-1}>
          {t('bots.settings.skills.add')}
        </Button>
      </div>
      <SettingsGroup aria-hidden>
        {SKILLS.map(({ line, meta }) => (
          <SettingsListRow
            key={line}
            meta={
              <span className="flex h-4.5 items-center">
                <Skeleton shape="sm" className={`h-2.5 ${meta}`} />
              </span>
            }
            actions={
              <>
                <Skeleton shape="pill" className="size-7" />
                <Skeleton shape="pill" className="size-7" />
              </>
            }
          >
            <span className="flex h-5 items-center">
              <Skeleton shape="sm" className={`h-3 ${line}`} />
            </span>
          </SettingsListRow>
        ))}
      </SettingsGroup>
    </section>
  );
}
