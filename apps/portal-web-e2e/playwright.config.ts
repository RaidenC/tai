import { defineConfig, devices } from '@playwright/test';
import { nxE2EPreset } from '@nx/playwright/preset';

// For CI, you may want to set BASE_URL to the deployed application.
const baseURL = process.env['BASE_URL'] || 'http://localhost:4200';

/**
 * Read environment variables from file.
 * https://github.com/motdotla/dotenv
 */
// require('dotenv').config();

/**
 * See https://playwright.dev/docs/test-configuration.
 */
export default defineConfig({
    ...nxE2EPreset(__filename, { testDir: './src' }),
    workers: process.env['CI'] ? 1 : '50%',
    retries: process.env['CI'] ? 2 : 0,
    /* Shared settings for all the projects below. See https://playwright.dev/docs/api/class-testoptions. */
    use: {
        baseURL,
        /* Collect trace when retrying the failed test. See https://playwright.dev/docs/trace-viewer */
        trace: 'on-first-retry',
        launchOptions: {
            hosts: {
                'acme.localhost': '127.0.0.1'
            }
        }
    },
    /* Run your local dev server before starting the tests */
    /* webServer: process.env['CI'] ? [] : [
        {
            command: 'npx nx serve portal-api',
            url: 'http://localhost:5031/diag/headers',
            reuseExistingServer: true,
            timeout: 60000,
        },
        {
            command: 'npx nx serve identity-ui',
            url: 'http://localhost:4300',
            reuseExistingServer: true,
            timeout: 60000,
        },
        {
            command: 'npx nx serve portal-web',
            url: 'http://localhost:4200',
            reuseExistingServer: true,
            timeout: 60000,
        }
    ], */
    projects: [
        {
            name: 'setup',
            testMatch: /.*\.setup\.ts/,
        },
        {
            name: 'chromium',
            use: {
                ...devices['Desktop Chrome'],
            },
            dependencies: ['setup'],
        }
    ],
});
