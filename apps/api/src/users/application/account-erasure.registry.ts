import { Injectable } from '@nestjs/common';
import { ACCOUNT_ERASURE_STEPS, type AccountErasurePort } from './account-erasure.port';

/**
 * What goes with an account, collected at boot through
 * {@link UsersModule.contributeAccountErasure} and run in
 * {@link ACCOUNT_ERASURE_STEPS} order.
 */
@Injectable()
export class AccountErasureRegistry {
  private readonly contributions: AccountErasurePort[] = [];

  registerAll(contributions: readonly AccountErasurePort[]): void {
    for (const contribution of contributions) {
      if (!this.contributions.includes(contribution)) this.contributions.push(contribution);
    }
  }

  async eraseFor(userId: string): Promise<void> {
    for (const step of ACCOUNT_ERASURE_STEPS) {
      for (const contribution of this.contributions) {
        if (contribution.step === step) await contribution.eraseFor(userId);
      }
    }
  }
}
