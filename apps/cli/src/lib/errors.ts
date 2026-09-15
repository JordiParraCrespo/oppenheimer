/**
 * Exit codes. Scripts branch on these, so they are part of the CLI's contract:
 * changing one is a breaking change.
 */
export const ExitCode = {
  OK: 0,
  /** Something went wrong that does not fit a more specific code. */
  FAILURE: 1,
  /** The command was used incorrectly (bad flag, missing argument). */
  USAGE: 2,
  /** Not logged in, or the credential is no longer valid. */
  AUTH: 3,
  /** Authenticated, but not permitted — a missing scope or role. */
  FORBIDDEN: 4,
  /** The thing being addressed does not exist. */
  NOT_FOUND: 5,
  /** The API could not be reached. */
  UNREACHABLE: 6,
} as const;

export type ExitCodeValue = (typeof ExitCode)[keyof typeof ExitCode];

/** An error already phrased for the user, carrying the exit code to use. */
export class CliError extends Error {
  constructor(
    message: string,
    readonly exitCode: ExitCodeValue = ExitCode.FAILURE,
    /** Optional next step, printed under the error. */
    readonly hint?: string,
  ) {
    super(message);
    this.name = 'CliError';
  }
}

/** Thrown when a command needs a credential and none is configured. */
export class NotLoggedInError extends CliError {
  constructor(profile: string) {
    super(
      `No credential stored for profile "${profile}".`,
      ExitCode.AUTH,
      'Run `oppenheimer login` first, or pass --token.',
    );
  }
}
