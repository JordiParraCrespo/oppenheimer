/// <reference path="./novnc.d.ts" />
import type RFB from '@novnc/novnc';

/**
 * noVNC's RFB client, loaded with the first desktop shown: a reader who never
 * opens one never downloads it. A function of its own because the React
 * Compiler cannot compile a component or hook that holds an `import()`.
 */
export async function loadRfb(): Promise<typeof RFB> {
  return (await import('@novnc/novnc')).default;
}
