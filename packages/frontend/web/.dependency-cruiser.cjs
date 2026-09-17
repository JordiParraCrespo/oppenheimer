/** Architecture fitness rules — see packages/frontend/web/ARCHITECTURE.md. Run with: pnpm --filter @oppenheimer/frontend-web arch */
module.exports = require('@oppenheimer/tsconfig/depcruise/frontend-kit.cjs')({
  leaves: ['platform', 'theme', 'i18n', 'analytics', 'forms'],
  middle: ['table', 'layout', 'roles'],
  top: ['shell', 'auth'],
});
