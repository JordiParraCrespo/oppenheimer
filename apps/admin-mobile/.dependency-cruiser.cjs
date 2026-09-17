/** Architecture fitness rules — see ARCHITECTURE.md. Run with: pnpm --filter @oppenheimer/admin-mobile arch */
module.exports = require('@oppenheimer/tsconfig/depcruise/frontend-app.cjs')({
  product: 'admin',
  platform: 'mobile',
  routes: 'app',
  features: 'features',
});
