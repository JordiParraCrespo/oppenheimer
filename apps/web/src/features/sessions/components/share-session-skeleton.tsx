import { Button, Input, Separator, Skeleton } from '@oppenheimer/design-system-web';
import { ClockIcon, EyeIcon, LockIcon, MailIcon } from '@oppenheimer/design-system-web/icons';
import type { ComponentType, ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { ShareSettingRow } from './share-setting-row';

/**
 * Share while the session and its share are read: the panel a session not
 * yet shared opens on, its labels written and its controls disabled, with
 * bars where the read answers (the session's name and host, each setting's
 * value).
 */
export function ShareSessionSkeleton({
  Title,
}: {
  Title: ComponentType<{ className?: string; children: ReactNode }>;
}) {
  const { t } = useTranslation();
  const value = (
    <span className="flex h-(--control-h-sm) items-center">
      <Skeleton shape="sm" className="h-2.5 w-16" />
    </span>
  );
  return (
    <div aria-busy className="flex min-h-0 flex-col">
      <div className="flex flex-col gap-0.5 px-4 pt-3.5 pb-3">
        <Title className="text-[14px] font-medium">{t('sessions.share.title')}</Title>
        <span className="flex h-4.5 items-center">
          <Skeleton shape="sm" className="h-2.5 w-40" />
        </span>
      </div>
      <div className="flex flex-col gap-3.5 px-4 pb-3.5">
        <div className="flex items-start gap-2">
          <Input
            disabled
            leading={<MailIcon className="size-[15px]" />}
            placeholder={t('sessions.share.peoplePlaceholder')}
            aria-label={t('sessions.share.peopleLabel')}
          />
          <Button type="button" disabled>
            {t('sessions.share.inviteSubmit')}
          </Button>
        </div>
        <div className="flex flex-col">
          <ShareSettingRow
            icon={<LockIcon />}
            label={t('sessions.share.generalAccess')}
            control={value}
          />
          <ShareSettingRow
            icon={<EyeIcon />}
            label={t('sessions.share.permission')}
            control={value}
          />
          <ShareSettingRow
            icon={<ClockIcon />}
            label={t('sessions.share.expires')}
            control={value}
          />
        </div>
      </div>
      <Separator />
      <div className="flex min-h-12 items-center px-4 py-2.5">
        <span className="flex h-4 items-center">
          <Skeleton shape="sm" className="h-2.5 w-44" />
        </span>
      </div>
    </div>
  );
}
