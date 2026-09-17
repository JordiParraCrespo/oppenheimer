'use client';
import { useStore } from 'zustand';
import type { AuthState } from '../modules/auth/auth.state';
import { useOppenheimerApp } from './context';

export function useAuthState(): AuthState {
  const auth = useOppenheimerApp().auth;
  return useStore(auth.store);
}
