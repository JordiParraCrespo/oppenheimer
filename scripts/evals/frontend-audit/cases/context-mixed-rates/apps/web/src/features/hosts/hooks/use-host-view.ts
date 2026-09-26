import { createContext, useContext } from 'react';

export type HostDensity = 'comfortable' | 'compact';

/** How the host board is being looked at: its density, and the card under the pointer. */
export interface HostView {
  density: HostDensity;
  hoveredId: string | null;
  setHoveredId: (id: string | null) => void;
}

export const HostViewContext = createContext<HostView>({
  density: 'comfortable',
  hoveredId: null,
  setHoveredId: () => {},
});

export function useHostView(): HostView {
  return useContext(HostViewContext);
}
