import { useConnectGmail } from '@oppenheimer/frontend-consumer/react';
import { useEffect, useRef } from 'react';

/**
 * Hands Google's redirect to the API once, on arrival
 * (`product/next-steps/mail.md` §1). Syncs with the browser's address: the
 * code and state Google put on it are single-use, so a second POST (Strict
 * Mode's remount) would only fail.
 */
export function useGmailReturn(params: { code?: string; state?: string; error?: string }) {
  const connect = useConnectGmail();
  const sent = useRef(false);
  const { code, state, error } = params;
  useEffect(() => {
    if (sent.current || error || !code || !state) return;
    sent.current = true;
    connect.mutate({ code, state });
  }, [code, state, error, connect]);
  return connect;
}
