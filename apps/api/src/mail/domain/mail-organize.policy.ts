/**
 * Organizing mail (`product/next-steps/mail.md` §3.5) as the label changes
 * Gmail makes it: read state, stars, importance and the inbox are system
 * labels, so marking and archiving are labels added and taken off like any
 * other.
 */

/** Labels to add and to take off, by Gmail's label ids. */
export interface MailLabelChange {
  add: readonly string[];
  remove: readonly string[];
}

/** What a mark asks for; a field left out is left as it is. */
export interface MailMarks {
  read?: boolean;
  starred?: boolean;
  important?: boolean;
}

/** The label change a mark makes; empty when it asks for nothing. */
export function markChange(marks: MailMarks): MailLabelChange {
  const add: string[] = [];
  const remove: string[] = [];
  // Read is the absence of UNREAD; starred and important are labels of their own.
  if (marks.read === true) remove.push('UNREAD');
  if (marks.read === false) add.push('UNREAD');
  if (marks.starred === true) add.push('STARRED');
  if (marks.starred === false) remove.push('STARRED');
  if (marks.important === true) add.push('IMPORTANT');
  if (marks.important === false) remove.push('IMPORTANT');
  return { add, remove };
}

/** Archiving takes threads out of the inbox and nothing else. */
export const ARCHIVE_CHANGE: MailLabelChange = { add: [], remove: ['INBOX'] };
