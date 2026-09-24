import { test as teardown } from '@playwright/test';
import { FLEET_HOSTS, teardownFleet } from '../../support/fleet';

// Every host and the git server: with containers, the network too; with
// `FLEET_HOSTS=local`, the hosts' Unix accounts, supervisors and tmux servers.
// `KEEP_FLEET=1` leaves containers up for poking at after a failure
// (`docker ps --filter label=dev.oppenheimer.fleet=1`). It is refused for local
// hosts: what it would leave running is accounts and a writable git server on
// the machine itself, not a sandbox.
teardown('remove the fleet', () => {
  if (process.env.KEEP_FLEET && FLEET_HOSTS === 'local') {
    console.warn('KEEP_FLEET is ignored with FLEET_HOSTS=local: local hosts are always removed');
  }
  if (!process.env.KEEP_FLEET || FLEET_HOSTS === 'local') teardownFleet();
});
