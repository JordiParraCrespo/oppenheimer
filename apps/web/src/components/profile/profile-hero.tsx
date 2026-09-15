import {
  Alert,
  AlertDescription,
  Avatar,
  AvatarFallback,
  AvatarImage,
  Card,
} from '@oppenheimer/design-system-web';
import { Camera } from '@oppenheimer/design-system-web/icons';
import type { ProfileEntity } from '@oppenheimer/frontend';
import { useUploadAvatar } from '@oppenheimer/frontend/react';
import { useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { RolePill } from '@/components/role-pill';
import { formatMonthYear } from '@/lib/format-date';
import { useErrorMessage } from '@/lib/use-error-message';

/**
 * The card above the settings panes: who you are, at a glance. The camera
 * button on the avatar is the only way to change the picture — a separate
 * upload row would be a second place to look for one control.
 */
export function ProfileHero({ profile }: { profile: ProfileEntity }) {
  const { t, i18n } = useTranslation();
  const resolveError = useErrorMessage();
  const fileInput = useRef<HTMLInputElement>(null);
  const upload = useUploadAvatar();

  return (
    <>
      <Card className="gap-0 py-0">
        <div className="flex items-center gap-[18px] px-[22px] py-5">
          <span className="relative flex-none">
            <Avatar size={64}>
              {profile.avatarUrl && <AvatarImage src={profile.avatarUrl} alt="" />}
              <AvatarFallback gradient="purple">{profile.initials}</AvatarFallback>
            </Avatar>
            <button
              type="button"
              title={t('profile.changePhoto')}
              aria-label={t('profile.changePhoto')}
              disabled={upload.isPending}
              onClick={() => fileInput.current?.click()}
              className="absolute -right-0.5 -bottom-0.5 flex size-[26px] cursor-pointer items-center justify-center rounded-full border-2 bg-surface-inverse [border-color:var(--chrome-bg)] disabled:opacity-60"
            >
              <Camera className="size-[13px] text-on-inverse" />
            </button>
            <input
              ref={fileInput}
              type="file"
              accept="image/png,image/jpeg,image/webp"
              className="hidden"
              onChange={(event) => {
                const file = event.target.files?.[0];
                // Cleared so picking the same file twice still fires a change.
                event.target.value = '';
                if (file) upload.mutate(file);
              }}
            />
          </span>

          <div className="min-w-0 flex-1">
            <h2 className="m-0 text-2xl leading-tight font-medium text-ink-900">
              {profile.fullName}
            </h2>
            <div className="mt-[5px] flex flex-wrap items-center gap-2.5 text-sm text-ink-600">
              <RolePill role={profile.role} />
              <span>{profile.email}</span>
              <span aria-hidden="true">·</span>
              <span>
                {t('profile.joined', {
                  date: formatMonthYear(profile.createdAt, i18n.language),
                })}
              </span>
            </div>
          </div>
        </div>
      </Card>

      {upload.error && (
        <Alert variant="destructive" className="mt-4">
          <AlertDescription>{resolveError(upload.error).message}</AlertDescription>
        </Alert>
      )}
    </>
  );
}
