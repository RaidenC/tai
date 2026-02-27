import type { StorybookConfig } from '@storybook/angular';

/**
 * Storybook Main Configuration for SWBC AutoPilot
 * Context: Angular 21
 * 
 * This configuration leverages the standard Storybook Angular integration.
 */
const config: StorybookConfig = {
  stories: [
    '../src/**/*.mdx',
    '../src/**/*.stories.@(js|jsx|mjs|ts|tsx)',
    '../../../libs/ui/**/*.mdx',        // Include shared UI library stories
    '../../../libs/ui/**/*.stories.@(js|jsx|mjs|ts|tsx)'
  ],
  addons: [],
  framework: {
    name: '@storybook/angular',
    options: {},
  },
  staticDirs: ['../public'],
};

export default config;