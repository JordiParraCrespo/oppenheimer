'use client';

/**
 * Query key factory for the Inbox (`product/versions/mvp/28-inbox.md`). Its
 * items are read through their sources' own keys; what is the Inbox's alone
 * is the caller's marks, announced by `inboxMark.changed`.
 */
export const inboxKeys = {
  all: ['inbox'] as const,
  marks: () => [...inboxKeys.all, 'marks'] as const,
};
