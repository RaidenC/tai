import { TestRunnerConfig } from '@storybook/test-runner';
import { injectAxe, checkA11y } from 'axe-playwright';

/*
 * See https://storybook.js.org/docs/react/writing-tests/test-runner#test-hook-api-experimental
 * to learn more about the test-runner hooks API.
 */
const config: TestRunnerConfig = {
  async preVisit(page) {
    await injectAxe(page);
  },
  async postVisit(page) {
    await page.evaluate(async () => {
      const finiteAnimations = document.getAnimations().filter((animation) => {
        const endTime = animation.effect?.getComputedTiming().endTime;
        return (
          animation.playState === 'running' &&
          typeof endTime === 'number' &&
          Number.isFinite(endTime)
        );
      });

      await Promise.allSettled(
        finiteAnimations.map((animation) => animation.finished),
      );
    });

    // 1. Accessibility Check
    await checkA11y(page, '#storybook-root', {
      detailedReport: true,
      detailedReportOptions: {
        html: true,
      },
    });

    // 2. CSP Guardrail: No inline styles (no [style] attribute in #storybook-root)
    const inlineStylesCount = await page
      .locator('#storybook-root [style]')
      .count();
    if (inlineStylesCount > 0) {
      throw new Error(
        `CSP Violation: Found ${inlineStylesCount} elements with inline styles. Inline styles are prohibited by Zero-Trust architecture.`,
      );
    }
  },
};

export default config;
