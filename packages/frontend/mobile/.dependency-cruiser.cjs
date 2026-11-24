/** Architecture fitness rules — see packages/frontend/mobile/ARCHITECTURE.md. Run with: pnpm --filter @oppenheimer/frontend-mobile arch */
module.exports = require('@oppenheimer/tsconfig/depcruise/frontend-kit.cjs')({
  leaves: ['platform', 'theme', 'analytics', 'forms', 'config'],
  middle: ['i18n', 'layout'],
  top: ['auth'],
});
