import { createFileRoute } from '@tanstack/react-router';
import {
  AcceptInvitationScreen,
  type AcceptInvitationSearch,
} from '@/features/organizations/screens/accept-invitation';

export const Route = createFileRoute('/_auth/accept-invitation')({
  validateSearch: (search: Record<string, unknown>): AcceptInvitationSearch => ({
    id: (search.id as string) || undefined,
    email: (search.email as string) || undefined,
    name: (search.name as string) || undefined,
    role: (search.role as string) || undefined,
    inviter: (search.inviter as string) || undefined,
  }),
  component: AcceptInvitationPage,
});

function AcceptInvitationPage() {
  const search = Route.useSearch();

  return <AcceptInvitationScreen {...search} />;
}
