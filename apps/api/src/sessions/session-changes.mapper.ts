import type { SessionCheckoutChangesResponse } from '@oppenheimer/shared';
import type { SessionCheckoutChangesListing } from './application/session-changes.port';

/** A session's changes, as the console reads them. */
export class SessionChangesMapper {
  /**
   * One checkout the runner read: every optional field the wire leaves out
   * made explicit, and the checkout's totals summed over the files it named.
   */
  static toResponse(checkout: SessionCheckoutChangesListing): SessionCheckoutChangesResponse {
    let additions = 0;
    let deletions = 0;
    const files = checkout.files.map((file) => {
      additions += file.additions;
      deletions += file.deletions;
      return {
        path: file.path,
        oldPath: file.oldPath ?? null,
        status: file.status,
        additions: file.additions,
        deletions: file.deletions,
        binary: file.binary ?? false,
        patch: file.patch ?? null,
        patchOmitted: file.patchOmitted ?? false,
      };
    });
    return {
      repository: checkout.repo,
      checkoutId: checkout.checkoutId ?? null,
      baseBranch: checkout.baseBranch ?? null,
      base: checkout.base ?? null,
      approximate: checkout.approximate ?? false,
      files,
      omittedFiles: checkout.omittedFiles ?? 0,
      additions,
      deletions,
    };
  }
}
