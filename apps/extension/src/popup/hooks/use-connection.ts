import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { OppenheimerConnection } from '@/sessions/store';

/**
 * Connect Oppenheimer, or disconnect it. Chrome is asked for the API's host
 * first, inside the click that asked: a host permission can only be granted
 * from a person's gesture, and only the one host they named is asked for.
 * The worker keeps the connection once the API took a report with it.
 */
export function useConnection() {
  const { t } = useTranslation();
  const [pending, setPending] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);

  async function connect(connection: OppenheimerConnection) {
    setProblem(null);
    let origin: string;
    try {
      origin = new URL(connection.apiUrl).origin;
    } catch {
      setProblem(t('oppenheimer.notAUrl'));
      return;
    }
    const granted = await chrome.permissions.request({ origins: [`${origin}/*`] });
    if (!granted) {
      setProblem(t('oppenheimer.permission', { origin }));
      return;
    }
    setPending(true);
    try {
      const answer = (await chrome.runtime.sendMessage({
        type: 'connect',
        connection: { apiUrl: origin, token: connection.token.trim() },
      })) as { ok: boolean; detail?: string };
      if (!answer.ok) setProblem(t('oppenheimer.refused', { detail: answer.detail ?? '' }));
    } finally {
      setPending(false);
    }
  }

  async function disconnect() {
    await chrome.runtime.sendMessage({ type: 'disconnect' });
  }

  return { connect, disconnect, pending, problem };
}
