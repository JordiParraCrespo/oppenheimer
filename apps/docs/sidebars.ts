import type { SidebarsConfig } from '@docusaurus/plugin-content-docs';

const sidebars: SidebarsConfig = {
  docs: [
    'intro',
    {
      type: 'category',
      label: 'Getting Started',
      items: [
        'getting-started/installation',
        'getting-started/project-structure',
        'getting-started/google-sign-in',
      ],
    },
    {
      type: 'category',
      label: 'Architecture',
      items: [
        'architecture/overview',
        'architecture/backend-packages',
        'architecture/api-architecture',
        'architecture/frontend-architecture',
        'architecture/query-keys',
        'architecture/analytics',
        // oppenheimer:begin runner
        'architecture/go-services',
        // oppenheimer:end runner
      ],
    },
    'errors',
    {
      type: 'category',
      label: 'Deployment',
      items: ['deployment/tier-1-cheap'],
    },
  ],
};

export default sidebars;
