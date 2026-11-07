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
        'architecture/error-reporting',
        // oppenheimer:begin runner
        'architecture/go-services',
        // oppenheimer:end runner
      ],
    },
    // oppenheimer:begin cli|mcp
    {
      type: 'category',
      label: 'CLI and MCP',
      items: [
        // oppenheimer:begin cli
        'tooling/cli',
        // oppenheimer:end cli
        // oppenheimer:begin mcp
        'tooling/mcp',
        // oppenheimer:end mcp
      ],
    },
    // oppenheimer:end cli|mcp
    'errors',
    {
      type: 'category',
      label: 'Deployment',
      items: ['deployment/tier-1-cheap', 'deployment/monitoring'],
    },
  ],
};

export default sidebars;
