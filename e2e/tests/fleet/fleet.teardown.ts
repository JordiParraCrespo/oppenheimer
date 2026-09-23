import { test as teardown } from '@playwright/test';
import { teardownFleet } from '../../support/fleet';

// Every host, the git server and the network. `KEEP_FLEET=1` leaves them up
// for poking at after a failure (`docker ps --filter label=dev.oppenheimer.fleet=1`).
teardown('remove the fleet', () => {
  if (!process.env.KEEP_FLEET) teardownFleet();
});
