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
  const set = (wanted: boolean | undefined, label: string, whenTrue: 'add' | 'remove') => {
    if (wanted === undefined) return;
    const adds = wanted === (whenTrue === 'add');
    (adds ? add : remove).push(label);
  };
  set(marks.read, 'UNREAD', 'remove');
  set(marks.starred, 'STARRED', 'add');
  set(marks.important, 'IMPORTANT', 'add');
  return { add, remove };
}

/** Archiving takes threads out of the inbox and nothing else. */
export const ARCHIVE_CHANGE: MailLabelChange = { add: [], remove: ['INBOX'] };
