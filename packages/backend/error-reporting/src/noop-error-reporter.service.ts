import { ErrorReporter } from './error-reporter.service';

/** The reporter when no DSN is set: tests, local development, `generate:openapi`. */
export class NoopErrorReporter extends ErrorReporter {
  readonly enabled = false;

  capture(): undefined {
    return undefined;
  }

  async flush(): Promise<boolean> {
    return true;
  }
}
