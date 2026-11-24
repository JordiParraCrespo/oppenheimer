/**
 * The console page of one of the owner's sessions, the link a bot writes
 * where the chat draws no button for it (a WhatsApp or Telegram chat). It
 * opens for the owner signed in to the console, nobody else; a guest's link
 * is a share (`/s/<slug>`), which the owner makes in the console.
 */
export function sessionLink(frontendUrl: string, sessionId: string): string {
  return new URL(`/sessions/${encodeURIComponent(sessionId)}`, frontendUrl).toString();
}
