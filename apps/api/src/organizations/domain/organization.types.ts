/**
 * An organization as the app reads it: Better Auth's `organization` row. A
 * read model — Better Auth writes the row, so there is no aggregate behind it
 * (the personal workspace, the one the app writes, is `PersonalWorkspaceEntity`).
 */
export interface Organization {
  id: string;
  name: string;
  slug: string;
  logo: string | null;
  metadata: Record<string, unknown> | null;
  createdAt: Date;
}

/** A workspace: a Better Auth team inside an organization. */
export interface Workspace {
  id: string;
  name: string;
  organizationId: string;
  createdAt: Date;
  updatedAt: Date | null;
}

/** One person's place in a workspace: a Better Auth `teamMember` row. */
export interface WorkspaceMember {
  id: string;
  teamId: string;
  userId: string;
  createdAt: Date;
}
