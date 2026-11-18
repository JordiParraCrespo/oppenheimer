import { usePaneDrop } from '@oppenheimer/frontend-web';

/**
 * Takes files dropped anywhere on the window for a bot's chat that is the
 * whole page. A chat beside a session does not mount it: a drop there belongs
 * to whatever it lands on, and the chat takes only those on its own box.
 */
export function BotPaneDrop({ onFiles }: { onFiles: (files: File[]) => void }) {
  usePaneDrop(onFiles);
  return null;
}
