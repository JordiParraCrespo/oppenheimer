export interface InvitationLinkData {
  id: string;
  email: string;
  role: string;
  inviterName: string;
}

/** Build the public registration link carried by an organization invitation. */
export function buildInvitationUrl(frontendUrl: string, data: InvitationLinkData): string {
  const url = new URL('/accept-invitation', frontendUrl);
  url.searchParams.set('id', data.id);
  url.searchParams.set('email', data.email);
  url.searchParams.set('role', data.role);
  url.searchParams.set('inviter', data.inviterName);
  return url.toString();
}
