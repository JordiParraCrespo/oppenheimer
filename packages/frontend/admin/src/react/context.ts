import { useOppenheimerApp } from '@oppenheimer/frontend-core/react';
import { AdminApp } from '../di/admin-app';

/** The product's services, from the same provider `useOppenheimerApp` reads. */
export function useAdminApp(): AdminApp {
  return AdminApp.for(useOppenheimerApp());
}
