import { toast } from '@oppenheimer/design-system-web';
import type {
  OrganizationInvitationEntity,
  OrganizationMemberEntity,
  RoleEntity,
} from '@oppenheimer/frontend';
import {
  useCancelOrganizationInvitation,
  useDeleteRole,
  useRemoveOrganizationMember,
} from '@oppenheimer/frontend/react';
import { useTranslation } from 'react-i18next';
import { ConfirmDialog } from '@/components/confirm-dialog';

export function RemoveMemberDialog({
  member,
  organizationId,
  onClose,
}: {
  member: OrganizationMemberEntity;
  organizationId: string;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const remove = useRemoveOrganizationMember();
  return (
    <ConfirmDialog
      title={t('pages.team.confirm.removeTitle')}
      description={t('pages.team.confirm.removeDescription')}
      pending={remove.isPending}
      error={remove.error}
      onClose={onClose}
      onConfirm={() =>
        remove.mutate(
          { organizationId, memberId: member.id },
          {
            onSuccess: () => {
              onClose();
              toast.success(t('toasts.memberRemoved'));
            },
          },
        )
      }
    />
  );
}

export function CancelInvitationDialog({
  invitation,
  organizationId,
  onClose,
}: {
  invitation: OrganizationInvitationEntity;
  organizationId: string;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const cancel = useCancelOrganizationInvitation();
  return (
    <ConfirmDialog
      title={t('pages.team.confirm.cancelTitle')}
      description={t('pages.team.confirm.cancelDescription')}
      pending={cancel.isPending}
      error={cancel.error}
      onClose={onClose}
      onConfirm={() =>
        cancel.mutate({ organizationId, invitationId: invitation.id }, { onSuccess: onClose })
      }
    />
  );
}

export function DeleteRoleDialog({ role, onClose }: { role: RoleEntity; onClose: () => void }) {
  const { t } = useTranslation();
  const remove = useDeleteRole();
  return (
    <ConfirmDialog
      title={t('pages.team.confirm.deleteRoleTitle')}
      description={t('pages.team.confirm.deleteRoleDescription')}
      pending={remove.isPending}
      error={remove.error}
      onClose={onClose}
      onConfirm={() => remove.mutate(role.id, { onSuccess: onClose })}
    />
  );
}
