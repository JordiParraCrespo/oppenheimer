import { randomUUID } from 'node:crypto';
import {
  AggregateRoot,
  ArgumentInvalidException,
  ArgumentNotProvidedException,
  type CreateEntityProps,
} from '@oppenheimer/backend-ddd';
import {
  INBOX_REPORT_ANSWER_MAX,
  INBOX_REPORT_BODY_MAX,
  INBOX_REPORT_IMAGE_MAX_BYTES,
  INBOX_REPORT_IMAGES_MAX,
  INBOX_REPORT_LINK_MAX,
  INBOX_REPORT_SOURCE_MAX,
  INBOX_REPORT_STATUSES,
  INBOX_REPORT_TITLE_MAX,
  type InboxReportImage,
  type InboxReportStatus,
} from '@oppenheimer/shared';
import { InboxReportChangedDomainEvent } from './events/inbox-report-changed.domain-event';
import { inboxReportImageName, isInboxReportImageMimeType } from './inbox-report.policy';

/** A report's picture as it is kept: what is shown of it, and where its bytes are. */
export interface StoredInboxReportImage extends InboxReportImage {
  storageKey: string;
}

export interface InboxReportProps {
  organizationId: string;
  /** Whose credential sent it; null once that account is gone. */
  createdByUserId: string | null;
  title: string;
  body: string;
  /** Who sent it, in the sender's own words. */
  source: string;
  /** Where the problem can be seen. */
  link: string | null;
  images: StoredInboxReportImage[];
  status: InboxReportStatus;
  answer: string | null;
  answeredByUserId: string | null;
  answeredAt: Date | null;
}

/** A picture as the sender attached it, already known by its bytes. */
export interface PostedInboxReportImage {
  mimeType: InboxReportImage['mimeType'];
  sizeBytes: number;
  /** The file's name as the sender gave it. */
  name: string;
  /** The stored file's extension, without its dot. */
  extension: string;
}

export interface PostInboxReportProps {
  organizationId: string;
  createdByUserId: string;
  title: string;
  body: string;
  source: string;
  link: string | null;
  images: PostedInboxReportImage[];
}

/**
 * A problem an agent sent to a workspace's Inbox, with its pictures
 * (`product/versions/mvp/29-inbox.md`, "Reports"). It waits on the person
 * until they answer it, once; the sender reads the answer back.
 */
export class InboxReportEntity extends AggregateRoot<InboxReportProps> {
  static create(create: CreateEntityProps<InboxReportProps>): InboxReportEntity {
    return new InboxReportEntity(create);
  }

  /** A new report, open; each picture's key names the workspace, the report and itself. */
  static post(props: PostInboxReportProps): InboxReportEntity {
    const id = randomUUID();
    const images = props.images.map((image) => {
      const imageId = randomUUID();
      return {
        id: imageId,
        storageKey: `inbox-reports/${props.organizationId}/${id}/${imageId}.${image.extension}`,
        mimeType: image.mimeType,
        sizeBytes: image.sizeBytes,
        name: inboxReportImageName(image.name),
      };
    });
    const report = new InboxReportEntity({
      id,
      props: {
        organizationId: props.organizationId,
        createdByUserId: props.createdByUserId,
        title: props.title,
        body: props.body,
        source: props.source,
        link: props.link,
        images,
        status: 'open',
        answer: null,
        answeredByUserId: null,
        answeredAt: null,
      },
    });
    report.validate();
    report.announce('sent');
    return report;
  }

  get organizationId(): string {
    return this.props.organizationId;
  }
  get createdByUserId(): string | null {
    return this.props.createdByUserId;
  }
  get title(): string {
    return this.props.title;
  }
  get body(): string {
    return this.props.body;
  }
  get source(): string {
    return this.props.source;
  }
  get link(): string | null {
    return this.props.link;
  }
  get images(): readonly StoredInboxReportImage[] {
    return this.props.images;
  }
  get status(): InboxReportStatus {
    return this.props.status;
  }
  get answer(): string | null {
    return this.props.answer;
  }
  get answeredByUserId(): string | null {
    return this.props.answeredByUserId;
  }
  get answeredAt(): Date | null {
    return this.props.answeredAt;
  }

  /** The person's one answer. A report already answered keeps the answer it has. */
  answerWith(text: string, userId: string, now: Date): void {
    if (this.props.status === 'answered') {
      throw new ArgumentInvalidException('A report is answered once');
    }
    this.props.status = 'answered';
    this.props.answer = text;
    this.props.answeredByUserId = userId;
    this.props.answeredAt = now;
    this.setUpdatedAt(now);
    this.validate();
    this.announce('answered');
  }

  private announce(what: string): void {
    this.addEvent(
      new InboxReportChangedDomainEvent({
        aggregateId: this.id,
        organizationId: this.props.organizationId,
        reportId: this.id,
        reason: `inbox report ${this.id}: ${what}`,
      }),
    );
  }

  public validate(): void {
    const { props } = this;
    if (!props.organizationId) {
      throw new ArgumentNotProvidedException('A report is sent to a workspace');
    }
    if (!props.title || props.title.length > INBOX_REPORT_TITLE_MAX) {
      throw new ArgumentInvalidException('A report has a title of at most INBOX_REPORT_TITLE_MAX');
    }
    if (
      props.body.length > INBOX_REPORT_BODY_MAX ||
      props.source.length > INBOX_REPORT_SOURCE_MAX
    ) {
      throw new ArgumentInvalidException('A report’s body or source is too long');
    }
    if (props.link !== null && (!props.link || props.link.length > INBOX_REPORT_LINK_MAX)) {
      throw new ArgumentInvalidException(
        'A report’s link is a URL of at most INBOX_REPORT_LINK_MAX',
      );
    }
    if (!INBOX_REPORT_STATUSES.includes(props.status)) {
      throw new ArgumentInvalidException(`${props.status} is not a report status`);
    }
    this.validateImages();
    const answered = props.status === 'answered';
    if (answered !== (props.answer !== null) || answered !== (props.answeredAt !== null)) {
      throw new ArgumentInvalidException('An answered report has its answer and when it was given');
    }
    if (props.answer !== null && (!props.answer || props.answer.length > INBOX_REPORT_ANSWER_MAX)) {
      throw new ArgumentInvalidException('An answer has text of at most INBOX_REPORT_ANSWER_MAX');
    }
  }

  private validateImages(): void {
    const { images } = this.props;
    if (images.length > INBOX_REPORT_IMAGES_MAX) {
      throw new ArgumentInvalidException(
        'A report carries at most INBOX_REPORT_IMAGES_MAX pictures',
      );
    }
    for (const image of images) {
      if (!image.id || !image.storageKey) {
        throw new ArgumentNotProvidedException('A report’s picture is stored');
      }
      if (!isInboxReportImageMimeType(image.mimeType)) {
        throw new ArgumentInvalidException(`${image.mimeType} is not a picture a report carries`);
      }
      if (
        !Number.isInteger(image.sizeBytes) ||
        image.sizeBytes <= 0 ||
        image.sizeBytes > INBOX_REPORT_IMAGE_MAX_BYTES
      ) {
        throw new ArgumentInvalidException(
          'A picture has bytes, at most INBOX_REPORT_IMAGE_MAX_BYTES',
        );
      }
    }
  }
}
