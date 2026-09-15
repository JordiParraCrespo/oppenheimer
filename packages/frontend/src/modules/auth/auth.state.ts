import { createStore } from 'zustand/vanilla';

export interface AuthState {
  isAuthenticated: boolean;
}

export type AuthStore = ReturnType<typeof createAuthStore>;

export const createAuthStore = () =>
  createStore<AuthState>(() => ({
    isAuthenticated: false,
  }));
