import { useUserRoles } from '@oppenheimer/frontend-admin/react';
import { RolePill } from '@oppenheimer/frontend-web';
import { useTranslation } from 'react-i18next';

/**
 * The roles one user holds, as pills, waiting on its own query.
 *
 * It asks for the roles itself because the alternative was worse than it
 * looked: the table ran `useUsersRoles` over the page, built a `Map` from the
 * results, and handed that map to the column factory. The map was a new object
 * on every render, so the columns were a new array, so every cell in the table
 * redrew whenever any one user's roles landed. Now a row that is still waiting
 * is the only thing waiting.
 *
 * The query key is the same one `useUsersRoles` used, so eight rows are eight
 * cached entries rather than eight new requests, and the dialog that edits them
 * reads the same entry.
 *
 * In `sections/` rather than `components/` because it fetches, and a
 * `components/` file may not — see `.agents/rules/frontend-architecture.md`.
 */
export function UserRolesCell({ userId }: { userId: string }) {
  const { t } = useTranslation();
  const roles = useUserRoles(userId);

  if (!roles.data?.length)
    return <span className="text-ink-400">{t('control.users.noRoles')}</span>;

  return (
    <span className="flex flex-wrap gap-1">
      {roles.data.map((role) => (
        <RolePill key={role.id} role={role.name} />
      ))}
    </span>
  );
}
