import { Alert, AlertDescription, toast } from '@oppenheimer/design-system-web';
import type { OrganizationEntity } from '@oppenheimer/frontend-consumer';
import { useUpdateOrganization } from '@oppenheimer/frontend-consumer/react';
import { SectionHead, useErrorMessage } from '@oppenheimer/frontend-web';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  OrganizationForm,
  type OrganizationFormDto,
} from '@/features/organizations/forms/organization-form';

export function GeneralSettingsSection({
  organization,
  loading,
}: {
  organization: OrganizationEntity | undefined;
  loading: boolean;
}) {
  const { t } = useTranslation();
  const resolveError = useErrorMessage();
  const update = useUpdateOrganization();
  const [saved, setSaved] = useState(false);

  const defaults: OrganizationFormDto = {
    name: organization?.name ?? '',
    logo: organization?.logo ?? '',
  };

  // A success or request failure belongs to the values that produced it. Clear
  // both as soon as the user edits again so feedback never describes stale
  // input. Wiring this to user change handlers avoids treating cache-driven
  // form resets after a successful save as a new edit.
  const clearFeedback = () => {
    setSaved(false);
    update.reset();
  };

  const onSubmit = async (values: OrganizationFormDto) => {
    if (!organization) return;

    // Unchanged fields are omitted rather than redundantly written; an empty
    // changed logo means "remove the mark", which the API spells `null`.
    const changes = {
      ...(values.name !== organization.name ? { name: values.name } : {}),
      ...(values.logo !== (organization.logo ?? '') ? { logo: values.logo || null } : {}),
    };

    if (Object.keys(changes).length > 0) {
      await update.mutateAsync({ id: organization.id, changes });
    }

    setSaved(true);
    toast.success(t('settings.general.saveSuccess'));
  };

  return (
    <>
      <SectionHead title={t('settings.general.title')} sub={t('settings.general.description')} />

      {update.error && (
        <Alert variant="destructive" className="mb-4">
          <AlertDescription>{resolveError(update.error).message}</AlertDescription>
        </Alert>
      )}

      <OrganizationForm
        values={defaults}
        disabled={loading || !organization}
        isPending={update.isPending}
        saved={saved}
        onChange={clearFeedback}
        onSubmit={onSubmit}
      />
    </>
  );
}
