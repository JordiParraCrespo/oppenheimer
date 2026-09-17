import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogHero,
  DialogHeroPlate,
  DialogTitle,
} from '@oppenheimer/design-system-web';
import { KeyRound } from '@oppenheimer/design-system-web/icons';
import { useCreateApiToken, usePermissionCatalog } from '@oppenheimer/frontend-consumer/react';
import { useErrorMessage } from '@oppenheimer/frontend-web';
import { useTranslation } from 'react-i18next';
import { CreateApiTokenForm } from '@/features/api-tokens/forms/create-api-token-form';

/**
 * The design's "Create API key" modal, plus the one thing it does not show: a
 * key with no scopes can call nothing, so the permissions it grants are chosen
 * here rather than defaulted behind the reader's back.
 */
export function CreateApiTokenDialog({
  onClose,
  onCreated,
}: {
  onClose: () => void;
  onCreated: (secret: string) => void;
}) {
  const { t } = useTranslation();
  const resolveError = useErrorMessage();
  const catalog = usePermissionCatalog();
  const create = useCreateApiToken();

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-[620px]">
        <DialogHero gradient="blueLilac">
          <DialogHeroPlate>
            <KeyRound />
          </DialogHeroPlate>
        </DialogHero>
        <DialogHeader>
          <DialogTitle>{t('settings.api.createKeyTitle')}</DialogTitle>
          <DialogDescription>{t('settings.api.createKeySubtitle')}</DialogDescription>
        </DialogHeader>
        <CreateApiTokenForm
          groups={catalog.data?.groups ?? []}
          grantable={catalog.data?.grantable ?? []}
          loadingCatalog={catalog.isLoading}
          isPending={create.isPending}
          error={create.error ? resolveError(create.error).message : undefined}
          onCancel={onClose}
          onSubmit={({ name, scopes }) =>
            create.mutate(
              { name, scopes, expiresInDays: null },
              { onSuccess: ({ secret }) => onCreated(secret) },
            )
          }
        />
      </DialogContent>
    </Dialog>
  );
}
