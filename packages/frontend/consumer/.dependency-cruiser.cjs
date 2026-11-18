/** Architecture fitness rules. Run with: pnpm --filter @oppenheimer/frontend-consumer arch */
module.exports = require('@oppenheimer/tsconfig/depcruise/frontend-domain.cjs')({
  role: 'consumer',
});
