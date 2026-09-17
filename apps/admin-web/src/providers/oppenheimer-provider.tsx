import { OppenheimerProvider } from '@oppenheimer/frontend-core/react';
import type { ReactNode } from 'react';
import { app } from '@/lib/oppenheimer';

export function OppenheimerAppProvider({ children }: { children: ReactNode }) {
  return <OppenheimerProvider app={app}>{children}</OppenheimerProvider>;
}
