import { InboxReportChangedDomainEvent } from '../domain/events/inbox-report-changed.domain-event';
import { InboxReportEntity, type PostInboxReportProps } from '../domain/inbox-report.entity';

/**
 * A report is sent open, with each picture's key naming the workspace, the
 * report and the picture; it takes one answer, and each of the two moves
 * tells the workspace's consoles. Its shape is the table's.
 */
const NOW = new Date('2026-11-09T12:00:00Z');
const PNG = { mimeType: 'image/png' as const, sizeBytes: 12, name: 'shot.png', extension: 'png' };
const props: PostInboxReportProps = {
  organizationId: 'org-1',
  createdByUserId: 'user-1',
  title: 'Checkout is down',
  body: '',
  source: 'qa-explorer',
  link: null,
  images: [],
};

describe('InboxReportEntity', () => {
  it('is sent open, with an event naming the workspace and the report', () => {
    const report = InboxReportEntity.post(props);
    expect(report).toMatchObject({ status: 'open', answer: null, answeredAt: null });
    expect(report.domainEvents).toHaveLength(1);
    expect(report.domainEvents[0]).toBeInstanceOf(InboxReportChangedDomainEvent);
    expect(report.domainEvents[0]).toMatchObject({ organizationId: 'org-1', reportId: report.id });
  });

  it('keys each picture under its workspace and report, and keeps only the file’s own name', () => {
    const report = InboxReportEntity.post({
      ...props,
      images: [
        { ...PNG, name: 'C:\\Users\\ada\\shot.png' },
        { ...PNG, extension: 'jpg' },
      ],
    });
    const [first, second] = report.images;
    expect(first).toMatchObject({
      name: 'shot.png',
      storageKey: `inbox-reports/org-1/${report.id}/${first.id}.png`,
    });
    expect(second.storageKey).toBe(`inbox-reports/org-1/${report.id}/${second.id}.jpg`);
    expect(first.id).not.toBe(second.id);
  });

  it('takes one answer, from whom and when, with its own event', () => {
    const report = InboxReportEntity.post(props);
    report.clearEvents();
    report.answerWith('Roll it back', 'owner-1', NOW);
    expect(report).toMatchObject({
      status: 'answered',
      answer: 'Roll it back',
      answeredByUserId: 'owner-1',
      answeredAt: NOW,
    });
    expect(report.domainEvents).toHaveLength(1);
  });

  it('refuses a second answer and keeps the first', () => {
    const report = InboxReportEntity.post(props);
    report.answerWith('Roll it back', 'owner-1', NOW);
    report.clearEvents();
    expect(() => report.answerWith('Never mind', 'owner-1', NOW)).toThrow();
    expect(report.answer).toBe('Roll it back');
    expect(report.domainEvents).toHaveLength(0);
  });

  it.each([
    ['no title', { title: '' }],
    ['a title past 200 characters', { title: 'x'.repeat(201) }],
    ['a body past 4000 characters', { body: 'x'.repeat(4001) }],
    ['five pictures', { images: Array.from({ length: 5 }, () => PNG) }],
    ['a picture that is not an image', { images: [{ ...PNG, mimeType: 'text/plain' as never }] }],
    ['a picture past 5 MB', { images: [{ ...PNG, sizeBytes: 5 * 1024 * 1024 + 1 }] }],
  ])('refuses %s', (_, change) => {
    expect(() => InboxReportEntity.post({ ...props, ...change })).toThrow();
  });

  it('refuses an empty answer, and a stored report whose status and answer disagree', () => {
    expect(() => InboxReportEntity.post(props).answerWith('', 'owner-1', NOW)).toThrow();
    const open = InboxReportEntity.post(props);
    expect(() =>
      InboxReportEntity.create({ id: 'r-1', props: { ...open.getProps(), status: 'answered' } }),
    ).toThrow();
  });
});
