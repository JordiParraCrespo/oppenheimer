import { defineConfig } from '@hey-api/openapi-ts';

export default defineConfig({
  input: '../../../apps/api/openapi.json',
  output: {
    path: 'src/generated',
  },
  plugins: [
    '@hey-api/client-fetch',
    '@hey-api/typescript',
    '@hey-api/sdk',
    {
      name: '@tanstack/react-query',
      queryKeys: true,
      queryOptions: true,
    },
  ],
});
