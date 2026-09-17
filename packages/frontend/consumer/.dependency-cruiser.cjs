/** Architecture fitness rules — see packages/frontend/ARCHITECTURE.md. Run with: pnpm --filter @oppenheimer/frontend-consumer arch */
module.exports = require('@oppenheimer/tsconfig/depcruise/frontend-domain.cjs')({
  role: 'consumer',
});
