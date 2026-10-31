import { frontendVitestProjects } from '@oppenheimer/tsconfig/vitest-frontend.mjs';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

// `forks`, not the shared default: `use-open-minted.spec.ts` replaces
// `window.location`, which jsdom only lets go of outside a VM context.
export default defineConfig({ test: frontendVitestProjects({ react, pool: 'forks' }) });
