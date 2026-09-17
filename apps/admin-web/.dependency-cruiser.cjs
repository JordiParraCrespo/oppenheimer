/** Architecture fitness rules — see ARCHITECTURE.md. Run with: pnpm --filter @oppenheimer/admin-web arch */
module.exports = require('@oppenheimer/tsconfig/depcruise/frontend-app.cjs')({
  product: 'admin',
  platform: 'web',
  routes: 'src/routes',
  features: 'src/features',
});
