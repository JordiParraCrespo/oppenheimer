import type { InboxReportImage, InboxReportStatus } from '@oppenheimer/shared/schemas/inbox';

export type { InboxReportImage };

/**
 * A problem an unattended agent sent, with its pictures
 * (`product/versions/mvp/29-inbox.md`, "Reports"): the one Inbox item the API
 * stores, answered from its card and gone from the Inbox once it is.
 */
export class InboxReportEntity {
  constructor(
    public readonly id: string,
    public readonly title: string,
    /** Empty when the report has none. */
    public readonly body: string,
    /** Who sent it, in the sender's own words; empty when it did not say. */
    public readonly source: string,
    /** Where the problem can be seen; `null` when the sender gave none. */
    public readonly link: string | null,
    /** Its pictures, in the order sent; their bytes are read by id. */
    public readonly images: readonly InboxReportImage[],
    public readonly status: InboxReportStatus,
    public readonly createdAt: Date,
  ) {}

  /**
   * The link as an address a browser may open: http or https, which is all
   * the API takes. Anything else an agent's text might carry is not offered.
   */
  get href(): string | null {
    return this.link && /^https?:\/\//i.test(this.link) ? this.link : null;
  }

  /** Still waiting on the person: an answered report has left the Inbox. */
  get isOpen(): boolean {
    return this.status === 'open';
  }
}
