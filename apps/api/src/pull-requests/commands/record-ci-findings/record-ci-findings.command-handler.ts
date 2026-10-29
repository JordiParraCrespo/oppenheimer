import { Inject } from '@nestjs/common';
import { CommandHandler, type ICommandHandler } from '@nestjs/cqrs';
import { AppError } from '@oppenheimer/backend-core';
import type { PullRequestAccessPort } from '../../../github/application/pull-request-access.port';
import { PULL_REQUEST_ACCESS } from '../../../github/github.di-tokens';
import type { CiFindingRepositoryPort } from '../../database/ci-finding.repository.port';
import { CiFindingEntity } from '../../domain/ci-finding.entity';
import { PullRequestsErrors } from '../../domain/pull-requests.errors';
import { CI_FINDING_REPOSITORY } from '../../pull-requests.di-tokens';
import { RecordCiFindingsCommand } from './record-ci-findings.command';

/**
 * Files what failing checks on a pull request came to
 * (`0.2-pull-requests.md`, "CI findings"). The pull request is read as the
 * caller, so a finding is filed only on one they can read, against the head
 * GitHub shows now, and only for a check failing on it: a finding about a
 * check that passed, or on a commit since pushed over, is not one. Answers the
 * head commit the findings were filed on.
 */
@CommandHandler(RecordCiFindingsCommand)
export class RecordCiFindingsCommandHandler
  implements ICommandHandler<RecordCiFindingsCommand, string>
{
  constructor(
    @Inject(PULL_REQUEST_ACCESS) private readonly access: PullRequestAccessPort,
    @Inject(CI_FINDING_REPOSITORY) private readonly findings: CiFindingRepositoryPort,
  ) {}

  async execute(command: RecordCiFindingsCommand): Promise<string> {
    const { scope, address } = command;
    if (!scope.organizationId) throw new AppError(PullRequestsErrors.NO_ACTIVE_ORGANIZATION);
    const snapshot = await this.access.pullRequest(scope, address);
    if (!snapshot.checks.value) {
      throw new AppError(PullRequestsErrors.CHECKS_UNREADABLE, {
        detail: `GitHub refused: ${snapshot.checks.refusal}`,
      });
    }
    const failing = (snapshot.checks.value.failing ?? []).map((check) => check.name);
    const strangers = command.findings.filter((finding) => !failing.includes(finding.check.trim()));
    if (strangers.length > 0) {
      throw new AppError(PullRequestsErrors.CHECK_NOT_FAILING, {
        detail: `Not failing on ${snapshot.pull.headSha.slice(0, 7)}: ${strangers.map((finding) => finding.check).join(', ')}. Failing: ${failing.join(', ') || 'none'}`,
      });
    }
    await this.findings.record(
      command.findings.map((finding) =>
        CiFindingEntity.record({
          ...finding,
          organizationId: scope.organizationId as string,
          githubRepoId: address.githubRepoId,
          number: address.number,
          headSha: snapshot.pull.headSha,
          recordedByUserId: scope.userId,
          recordedByBotId: command.botId,
        }),
      ),
    );
    return snapshot.pull.headSha;
  }
}
