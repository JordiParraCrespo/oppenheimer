import { afterAll, beforeAll } from 'vitest';
import {
  leakError,
  restoreWorld,
  type SharedWorld,
  snapshotWorld,
} from './src/__tests__/shared-world';

/**
 * The shared project runs every file of a worker in one module graph
 * (`isolate: false`), so what a file leaves behind is the next file's world.
 * This puts it back after each file and fails the file that left it, instead
 * of letting a later, unrelated file go red. `src/__tests__/shared-world.ts`
 * says what is checked.
 */
let world: SharedWorld;

beforeAll(() => {
  world = snapshotWorld();
});

afterAll(() => {
  const leaks = restoreWorld(world);
  if (leaks.length > 0) throw leakError(leaks);
});
