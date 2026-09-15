export default {
  extends: ['@commitlint/config-conventional'],
  rules: {
    'scope-enum': [
      2,
      'always',
      [
        'api',
        'web',
        'mobile',
        'docs',
        'shared',
        'frontend',
        'design-system',
        'api-client',
        'config',
        'translations',
        'infra',
        'ci',
      ],
    ],
  },
};
