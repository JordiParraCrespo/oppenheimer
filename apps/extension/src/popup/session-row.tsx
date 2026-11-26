import { SessionItem, type StatusState } from '@oppenheimer/design-system-web';
import { useTranslation } from 'react-i18next';
import { reasonText } from '@/i18n/translator';
import type { TrackedSession } from '@/sessions/session';
import { age } from './age';
import { openSession } from './open-session';
import { TeleportButton } from './teleport-button';

/** The design system's run-state word for each of ours: it picks the glyph's colour. */
const RUN_STATE: Record<TrackedSession['state'], StatusState> = {
  'needs-input': 'needs-input',
  failed: 'failed',
  running: 'running',
  done: 'completed',
  stopped: 'paused',
};

/**
 * One session that does not need you, on one line. The row opens it on
 * claude.ai/code; its reason and repository are its tooltip.
 */
export function SessionRow({ session, now }: { session: TrackedSession; now: number }) {
  const { t } = useTranslation();
  const detail = [reasonText(t, session.reason), session.repo].filter(Boolean).join(' · ');

  return (
    <SessionItem
      name={session.title}
      state={RUN_STATE[session.state]}
      status={age(session.updatedAt, now)}
      working={session.state === 'running'}
      title={detail || undefined}
      onClick={() => openSession(session.id)}
      action={<TeleportButton sessionId={session.id} />}
    />
  );
}
