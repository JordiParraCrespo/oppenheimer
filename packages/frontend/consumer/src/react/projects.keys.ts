'use client';

export const projectsKeys = {
  all: ['projects'] as const,
  lists: () => [...projectsKeys.all, 'list'] as const,
  list: () => [...projectsKeys.lists()] as const,
};
