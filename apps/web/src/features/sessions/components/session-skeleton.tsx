import { LoadingStatus } from '@oppenheimer/frontend-web';

/**
 * The pane's ground while the session is being read: the terminal's colour,
 * which the chat and the grid both stand on, and nothing on it. A session
 * opened from the sidebar answers as a chat or a terminal on that ground; a
 * slab in a 760px column on the canvas's grey flashed and then jumped to it.
 */
export function SessionSkeleton() {
  return (
    <div aria-busy className="min-h-0 flex-1 bg-term-bg">
      <LoadingStatus />
    </div>
  );
}
