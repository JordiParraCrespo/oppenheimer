import { inject, injectable } from 'inversify';
import { TOKENS } from '../../di/tokens';
import type {
  AutomationEntity,
  AutomationInput,
  AutomationRunEntity,
  RunHistory,
  RunHistoryFilter,
  RunPage,
  RunsFilter,
  TriggerInput,
  TriggerPreview,
  UpdateAutomationInput,
} from './automation.entity';
import type { AutomationsRepository } from './automations.repository';

@injectable()
export class AutomationsService {
  constructor(
    @inject(TOKENS.AutomationsRepository)
    private readonly repository: AutomationsRepository,
  ) {}

  findAll(): Promise<AutomationEntity[]> {
    return this.repository.findAll();
  }

  findById(id: string): Promise<AutomationEntity> {
    return this.repository.findById(id);
  }

  create(input: AutomationInput): Promise<AutomationEntity> {
    return this.repository.create(input);
  }

  update(id: string, input: UpdateAutomationInput): Promise<AutomationEntity> {
    return this.repository.update(id, input);
  }

  pause(id: string): Promise<AutomationEntity> {
    return this.repository.pause(id);
  }

  resume(id: string): Promise<AutomationEntity> {
    return this.repository.resume(id);
  }

  duplicate(id: string): Promise<AutomationEntity> {
    return this.repository.duplicate(id);
  }

  remove(id: string): Promise<void> {
    return this.repository.remove(id);
  }

  run(id: string, idempotencyKey: string): Promise<AutomationRunEntity> {
    return this.repository.run(id, idempotencyKey);
  }

  findRuns(filter: RunsFilter): Promise<RunPage> {
    return this.repository.findRuns(filter);
  }

  findRun(id: string): Promise<AutomationRunEntity> {
    return this.repository.findRun(id);
  }

  history(filter: RunHistoryFilter): Promise<RunHistory> {
    return this.repository.history(filter);
  }

  previewTrigger(trigger: Extract<TriggerInput, { source: 'github' }>): Promise<TriggerPreview> {
    return this.repository.previewTrigger(trigger);
  }
}
