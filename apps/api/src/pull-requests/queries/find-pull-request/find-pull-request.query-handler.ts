import { Inject } from '@nestjs/common';
import { type IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import type { PullRequestAccessPort } from '../../../github/application/pull-request-access.port';
import { PULL_REQUEST_ACCESS } from '../../../github/github.di-tokens';
import { CiFindingMapper } from '../../ci-finding.mapper';
import type { CiFindingRepositoryPort } from '../../database/ci-finding.repository.port';
import type { PullRequestDetailResponseDto } from '../../dtos/pull-request.response.dto';
import { PullRequestMapper } from '../../pull-request.mapper';
import { CI_FINDING_REPOSITORY } from '../../pull-requests.di-tokens';
import { FindPullRequestQuery } from './find-pull-request.query';

/**
 * One pull request's briefing: GitHub's detail, its lane, what holds it and
 * the path to merge, with what its head's failing checks came to.
 */
@QueryHandler(FindPullRequestQuery)
export class FindPullRequestQueryHandler
  implements IQueryHandler<FindPullRequestQuery, PullRequestDetailResponseDto>
{
  constructor(
    @Inject(PULL_REQUEST_ACCESS)
    private readonly access: PullRequestAccessPort,
    private readonly mapper: PullRequestMapper,
    @Inject(CI_FINDING_REPOSITORY) private readonly findings: CiFindingRepositoryPort,
    private readonly findingMapper: CiFindingMapper,
  ) {}

  async execute({ scope, address }: FindPullRequestQuery): Promise<PullRequestDetailResponseDto> {
    const [snapshot, viewerLogin] = await Promise.all([
      this.access.pullRequest(scope, address),
      this.access.viewerLogin(scope),
    ]);
    const findings = await this.findings.findForHead(scope, {
      githubRepoId: address.githubRepoId,
      number: address.number,
      headSha: snapshot.pull.headSha,
    });
    return {
      ...this.mapper.toDetail(snapshot, viewerLogin, new Date()),
      ciFindings: findings.map((finding) => this.findingMapper.toResponse(finding)),
    };
  }
}
