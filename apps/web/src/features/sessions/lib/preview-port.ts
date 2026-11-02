import type { SessionPort } from '@oppenheimer/frontend-consumer';

/**
 * The ports dev servers open on by default, the likeliest page first: Vite
 * and its preview, Angular, Astro, Create React App and Next, then the common
 * generic ones. A session that runs its API beside its front end (3001, 3002,
 * 8000 for a backend) opens on the front end.
 */
const FRONT_END_PORTS = [5173, 5174, 4200, 4321, 3000, 4173, 8080, 8081, 5000, 8000];

/**
 * The port the Browser tab shows when the reader has not picked one: the one
 * the reader picked while it is still listened on, else the likeliest front
 * end, else the lowest.
 */
export function previewPort(
  ports: readonly SessionPort[],
  picked: number | null,
): number | undefined {
  if (picked !== null && ports.some((one) => one.port === picked)) return picked;
  for (const port of FRONT_END_PORTS) {
    if (ports.some((one) => one.port === port)) return port;
  }
  return ports[0]?.port;
}
