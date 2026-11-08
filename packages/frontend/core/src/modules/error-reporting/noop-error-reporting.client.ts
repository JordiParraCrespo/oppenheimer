import type { IErrorReportingClient } from './error-reporting.client';

/** The client bound when the app passes no `errorReporting`: nothing is sent anywhere. */
export class NoopErrorReportingClient implements IErrorReportingClient {
  capture(): void {}

  setUser(): void {}
}
