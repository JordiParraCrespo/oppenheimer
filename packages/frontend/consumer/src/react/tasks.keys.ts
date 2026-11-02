'use client';

/**
 * One list, the whole board: every column, count and card reads it, and a
 * session's tasks are a `select` over it. A filtered read would be a second
 * leaf with its own segment, not an object `{}` would fuzzy-match.
 */
export const tasksKeys = {
  all: ['tasks'] as const,
  lists: () => [...tasksKeys.all, 'list'] as const,
  list: () => [...tasksKeys.lists()] as const,
  milestones: () => [...tasksKeys.all, 'milestones'] as const,
  milestoneList: () => [...tasksKeys.milestones(), 'list'] as const,
};
