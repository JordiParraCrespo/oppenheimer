import {
  Alert,
  AlertDescription,
  Avatar,
  AvatarFallback,
  AvatarImage,
  Button,
  SettingsRow,
} from '@oppenheimer/design-system-web';
import type { ProfileEntity } from '@oppenheimer/frontend-consumer';
import { useDeleteAvatar, useUploadAvatar } from '@oppenheimer/frontend-consumer/react';
import { useErrorMessage } from '@oppenheimer/frontend-core/react';
import { notifySuccess } from '@oppenheimer/frontend-web';
import { AVATAR_MIME_TYPES } from '@oppenheimer/shared/schemas/profile';
import { useRef } from 'react';
import { useTranslation } from 'react-i18next';

/**
 * Profile picture: the avatar as the console draws it, Upload beside it and
 * Remove once there is one. The file picker is a hidden input the button
 * clicks; the service refuses a wrong type or an oversized file before the
 * upload starts, and the failure reads under the hint.
 */
export function ProfilePictureSection({ profile }: { profile: ProfileEntity }) {
  const { t } = useTranslation();
  const resolveError = useErrorMessage();
  const input = useRef<HTMLInputElement>(null);
  const upload = useUploadAvatar({
    onSuccess: () => notifySuccess(t('toasts.pictureChanged')),
  });
  const remove = useDeleteAvatar({
    onSuccess: () => notifySuccess(t('toasts.pictureRemoved')),
  });
  const busy = upload.isPending || remove.isPending;
  const failure = upload.error ?? remove.error;

  return (
    <>
      <SettingsRow label={t('settings.profile.picture')} hint={t('settings.profile.pictureHint')}>
        <Avatar size="lg" variant="accent">
          {profile.avatarUrl ? <AvatarImage src={profile.avatarUrl} alt="" /> : null}
          <AvatarFallback>{profile.initials}</AvatarFallback>
        </Avatar>
        <input
          ref={input}
          type="file"
          accept={AVATAR_MIME_TYPES.join(',')}
          className="hidden"
          aria-label={t('settings.profile.picture')}
          onChange={(event) => {
            const file = event.currentTarget.files?.[0];
            // Cleared so choosing the same file again still fires a change.
            event.currentTarget.value = '';
            if (file) {
              remove.reset();
              upload.mutate(file);
            }
          }}
        />
        {profile.avatarUrl ? (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            disabled={busy}
            onClick={() => {
              upload.reset();
              remove.mutate();
            }}
          >
            {t('settings.profile.removePicture')}
          </Button>
        ) : null}
        <Button
          type="button"
          variant="secondary"
          size="sm"
          disabled={busy}
          onClick={() => input.current?.click()}
        >
          {upload.isPending ? t('settings.profile.uploading') : t('settings.profile.upload')}
        </Button>
      </SettingsRow>
      {failure ? (
        <div className="border-t border-border-subtle px-5 py-3">
          <Alert variant="destructive">
            <AlertDescription>
              {resolveError(failure, t('settings.profile.pictureFailed')).message}
            </AlertDescription>
          </Alert>
        </div>
      ) : null}
    </>
  );
}
