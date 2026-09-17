/** Architecture fitness rules — see ARCHITECTURE.md. Run with: pnpm --filter @oppenheimer/web arch */
module.exports = require('@oppenheimer/tsconfig/depcruise/frontend-app.cjs')({
  product: 'consumer',
  platform: 'web',
  routes: 'src/routes',
  features: 'src/features',
});
