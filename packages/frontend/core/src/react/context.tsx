'use client';
import type { ReactNode } from 'react';
import { createContext, useContext } from 'react';
import type { OppenheimerApp } from '../di/oppenheimer-app';

const OppenheimerContext = createContext<OppenheimerApp | null>(null);

export function OppenheimerProvider({
  app,
  children,
}: {
  app: OppenheimerApp;
  children: ReactNode;
}) {
  return <OppenheimerContext.Provider value={app}>{children}</OppenheimerContext.Provider>;
}

export function useOppenheimerApp(): OppenheimerApp {
  const app = useContext(OppenheimerContext);
  if (!app) throw new Error('useOppenheimerApp must be used within <OppenheimerProvider>');
  return app;
}
