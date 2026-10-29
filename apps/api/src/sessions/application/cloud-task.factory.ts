import { Inject, Injectable } from '@nestjs/common';
import { fitsPromptBound } from '@oppenheimer/shared';
import type { SessionFileMediaType } from '@oppenheimer/shared/protocol';
import { cloudTaskWithFiles } from '../domain/cloud-task.policy';
import type { SessionLaunchFile } from '../domain/session-launch-file.types';
import type { WorkSessionEntity } from '../domain/work-session.entity';
import { CLOUD_FILES } from '../sessions.di-tokens';
import { WorkSessionMapper } from '../work-session.mapper';
import type { CloudFilesPort } from './cloud-files.port';

/** A first task as a launch carries it: its text, and the files its host pulls. */
export interface LaunchTask {
  prompt?: string;
  images?: SessionLaunchFile[];
}

/**
 * How a cloud session's files travel: as links in its task, since its host
 * only starts it (`product/next-steps/cloud-agents.md`, "Files for a cloud
 * session"). The one place that composes that task, so what a create measures
 * and what a launch sends are the same string, built by the same function.
 */
@Injectable()
export class CloudTaskFactory {
  constructor(
    @Inject(CLOUD_FILES)
    private readonly files: CloudFilesPort,
  ) {}

  /**
   * Whether a task with these files fits a first task's bound, measured on
   * the text the agent would get with links of the real shape.
   */
  fits(prompt: string, files: readonly { mediaType: SessionFileMediaType }[]): boolean {
    const sample = files.map(() => this.files.sampleLink());
    return fitsPromptBound(
      cloudTaskWithFiles(prompt, WorkSessionMapper.toCloudTaskFiles(files, sample)),
    );
  }

  /**
   * The task a launch sends. A cloud session's files become fresh links in
   * its text, minted on every launch so a create sent again never names an
   * expired one, and none is sent as a file. Anything else is sent as it is.
   */
  async forLaunch(session: WorkSessionEntity, task: LaunchTask): Promise<LaunchTask> {
    if (session.place !== 'cloud' || !task.prompt || !task.images?.length) return task;
    const owner = { organizationId: session.organizationId, sessionId: session.id };
    const urls = await Promise.all(task.images.map((file) => this.files.link(owner, file)));
    return {
      prompt: cloudTaskWithFiles(
        task.prompt,
        WorkSessionMapper.toCloudTaskFiles(task.images, urls),
      ),
    };
  }
}
