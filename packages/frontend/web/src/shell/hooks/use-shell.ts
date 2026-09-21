import { createContext, type ReactNode, useContext } from 'react';
import type { NavItem, NavLink, ShellWorkspace } from '../lib/nav';

/**
 * What an app hands the shell once, at its authenticated layout: its
 * navigation, the account menu's extra links and the workspace to name.
 * Everything under `AppShell` reads this rather than being passed it.
 */
export interface ShellConfig {
  nav: readonly NavItem[];
  /** Links shown in the account menu above the language list. */
  userMenuLinks?: readonly NavLink[];
  workspace?: ShellWorkspace;
  /**
   * What fills the sidebar between the brand row and the account menu,
   * replacing the nav list.
   *
   * The console's sidebar *is* its session list, which needs a product hook
   * and so cannot live in a kit both apps load. An app that has something
   * better to put there passes it; the control plane, whose sidebar is a set
   * of destinations, passes nothing and keeps the nav.
   */
  sidebar?: ReactNode;
}

const ShellContext = createContext<ShellConfig | null>(null);

export const ShellProvider = ShellContext.Provider;

export function useShell(): ShellConfig {
  const config = useShellConfig();
  if (!config) throw new Error('useShell must be used within <AppShell>');
  return config;
}

/** The shell's config, or `null` outside `AppShell` — for hooks that also take it as an argument. */
export function useShellConfig(): ShellConfig | null {
  return useContext(ShellContext);
}
