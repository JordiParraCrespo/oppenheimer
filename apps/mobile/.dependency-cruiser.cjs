/** Architecture fitness rules — see ARCHITECTURE.md. Run with: pnpm --filter @oppenheimer/mobile arch */
module.exports = require('@oppenheimer/tsconfig/depcruise/frontend-app.cjs')({
  product: 'consumer',
  platform: 'mobile',
  routes: 'app',
  features: 'features',
});
