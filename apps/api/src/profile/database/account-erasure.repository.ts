import { Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';
import type { AccountErasurePort } from './account-erasure.repository.port';

/**
 * Raw SQL over tables owned by other modules — sessions, projects, Better
 * Auth's organizations and sign-ins — because this is the one write that
 * crosses them all, and mapping their entities here would couple the profile
 * module to every one of them for a single delete. Every statement is keyed
 * by the workspaces {@link findSoleWorkspaces} returned, so nothing another
 * person holds can be reached.
 */
@Injectable()
export class AccountErasureRepository implements AccountErasurePort {
  constructor(private readonly dataSource: DataSource) {}

  async findSoleWorkspaces(userId: string): Promise<string[]> {
    const rows: { organizationId: string }[] = await this.dataSource.query(
      `SELECT m."organizationId"
         FROM "member" m
        WHERE m."userId" = $1
          AND NOT EXISTS (
            SELECT 1 FROM "member" other
             WHERE other."organizationId" = m."organizationId"
               AND other."userId" <> $1
          )`,
      [userId],
    );
    return rows.map((row) => row.organizationId);
  }

  async hasSharedWork(userId: string, soleWorkspaceIds: readonly string[]): Promise<boolean> {
    const [row]: { shared: boolean }[] = await this.dataSource.query(
      `SELECT EXISTS (
                SELECT 1 FROM "work_session"
                 WHERE "createdByUserId" = $1 AND NOT ("organizationId" = ANY($2::uuid[]))
              )
           OR EXISTS (
                SELECT 1 FROM "github_installation"
                 WHERE "installedByUserId" = $1 AND NOT ("organizationId" = ANY($2::uuid[]))
              ) AS "shared"`,
      [userId, [...soleWorkspaceIds]],
    );
    return row?.shared === true;
  }

  async eraseWorkspaces(userId: string, workspaceIds: readonly string[]): Promise<void> {
    const ids = [...workspaceIds];
    await this.dataSource.transaction(async (manager) => {
      // Children first: every edge from here to the organization is RESTRICT.
      await manager.query(
        `DELETE FROM "work_session_event"
          WHERE "sessionId" IN (SELECT "id" FROM "work_session" WHERE "organizationId" = ANY($1::uuid[]))`,
        [ids],
      );
      await manager.query(
        `DELETE FROM "session_checkout" WHERE "organizationId" = ANY($1::uuid[])`,
        [ids],
      );
      await manager.query(`DELETE FROM "work_session" WHERE "organizationId" = ANY($1::uuid[])`, [
        ids,
      ]);
      // `project_repository` cascades from its project.
      await manager.query(`DELETE FROM "project" WHERE "organizationId" = ANY($1::uuid[])`, [ids]);
      // Members, roles, invitations, grants and GitHub installations cascade.
      await manager.query(`DELETE FROM "organization" WHERE "id" = ANY($1::uuid[])`, [ids]);
      // Better Auth's sign-ins and linked identities carry no foreign key to
      // `user`, so they would outlive it.
      await manager.query(`DELETE FROM "session" WHERE "userId" = $1`, [userId]);
      await manager.query(`DELETE FROM "account" WHERE "userId" = $1`, [userId]);
    });
  }
}
