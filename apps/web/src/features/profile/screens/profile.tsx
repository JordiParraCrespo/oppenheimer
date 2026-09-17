import { Alert, AlertDescription, Card, cn, Skeleton } from '@oppenheimer/design-system-web';
import {
  Lock,
  type LucideIcon,
  Monitor,
  SlidersHorizontal,
  UserRound,
} from '@oppenheimer/design-system-web/icons';
import { useMyProfile, useUploadAvatar } from '@oppenheimer/frontend-consumer/react';
import { PageHead, useErrorMessage } from '@oppenheimer/frontend-web';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ProfileHero } from '@/features/profile/components/profile-hero';
import { DetailsSection } from '@/features/profile/sections/details';
import { PasswordSection } from '@/features/profile/sections/password';
import { PreferencesSection } from '@/features/profile/sections/preferences';
import { SessionsSection } from '@/features/profile/sections/sessions';

const SECTIONS = [
  { key: 'details', icon: UserRound },
  { key: 'password', icon: Lock },
  { key: 'sessions', icon: Monitor },
  { key: 'preferences', icon: SlidersHorizontal },
] as const satisfies readonly { key: string; icon: LucideIcon }[];

type SectionKey = (typeof SECTIONS)[number]['key'];

/**
 * The signed-in user's own account: one hero card, then a sub-navigation into
 * four panes.
 *
 * The hero and the details pane both need the profile, so it is fetched once
 * here and handed down — the panes below it own their own data (sessions,
 * preferences), which is what lets a slow session list keep the rest of the
 * page interactive.
 */
export function ProfileScreen() {
  const { t } = useTranslation();
  const resolveError = useErrorMessage();
  const [section, setSection] = useState<SectionKey>('details');
  const profile = useMyProfile();
  const upload = useUploadAvatar();

  return (
    <>
      <PageHead title={t('pages.profile.title')} sub={t('pages.profile.description')} />

      {profile.isPending && (
        <Card className="gap-0 py-0">
          <div className="flex items-center gap-[18px] px-[22px] py-5">
            <Skeleton className="size-16 flex-none rounded-full" />
            <div className="flex flex-1 flex-col gap-2">
              <Skeleton className="h-6 w-48" />
              <Skeleton className="h-4 w-72" />
            </div>
          </div>
        </Card>
      )}

      {profile.error && (
        <Alert variant="destructive">
          <AlertDescription>{resolveError(profile.error).message}</AlertDescription>
        </Alert>
      )}

      {profile.data && (
        <>
          <ProfileHero
            profile={profile.data}
            uploading={upload.isPending}
            uploadError={upload.error ? resolveError(upload.error).message : undefined}
            onPickPhoto={(file) => upload.mutate(file)}
          />

          <div className="mt-6 grid items-start gap-9 [grid-template-columns:216px_1fr] max-[940px]:grid-cols-1 max-[940px]:gap-[22px]">
            <nav
              aria-label={t('pages.profile.title')}
              className="sticky top-0 flex flex-col gap-0.5"
            >
              {SECTIONS.map(({ key, icon: Icon }) => (
                <button
                  key={key}
                  type="button"
                  aria-current={section === key ? 'page' : undefined}
                  onClick={() => setSection(key)}
                  className={cn(
                    'flex w-full cursor-pointer items-center gap-2.5 rounded-md px-[11px] py-[9px] text-left text-base text-ink-600 transition-colors hover:bg-surface-hover hover:text-ink-900',
                    section === key && 'bg-surface-sunken font-medium text-ink-900',
                  )}
                >
                  <Icon
                    className={cn('size-[15px]', section === key ? 'text-ink-900' : 'text-ink-400')}
                  />
                  {t(`profile.sections.${key}`)}
                </button>
              ))}
            </nav>

            <div className="min-w-0">
              {section === 'details' && <DetailsSection profile={profile.data} />}
              {section === 'password' && <PasswordSection profile={profile.data} />}
              {section === 'sessions' && <SessionsSection />}
              {section === 'preferences' && <PreferencesSection />}
            </div>
          </div>
        </>
      )}
    </>
  );
}
