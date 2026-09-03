import { Meta, StoryObj } from '@storybook/angular';
import { expect, fn, type Mock, userEvent, within } from '@storybook/test';
import { OtpVerificationFormComponent } from './otp-verification-form';

/**
 * Storybook Configuration: OtpVerificationFormComponent
 *
 * Audit Proof: This story demonstrates that the OTP verification UI
 * strictly enforces the 6-digit numeric pattern required for
 * identity activation.
 */
type OtpStoryArgs = {
  verified: Mock<(code: string) => void>;
};

const verifiedSpy = fn<(code: string) => void>();

const renderWithVerifiedSpy = (verified: OtpStoryArgs['verified']) => ({
  props: { verified },
  template: `
    <tai-otp-verification-form (verified)="verified($event)"></tai-otp-verification-form>
  `,
});

const meta: Meta<OtpStoryArgs> = {
  title: 'Organisms/OtpVerificationForm',
  component: OtpVerificationFormComponent,
  args: {
    verified: verifiedSpy,
  },
  tags: ['autodocs'],
  render: () => renderWithVerifiedSpy(verifiedSpy),
};

export default meta;
type Story = StoryObj<OtpStoryArgs>;

export const Default: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const codeInput = canvas.getByRole('textbox', {
      name: 'Verification Code',
    });
    const verifyButton = canvas.getByRole('button', { name: 'Verify Code' });

    await expect(
      canvas.getByRole('heading', { name: 'Verify Your Email' }),
    ).toBeVisible();
    await expect(
      canvas.getByText(
        'Please enter the 6-digit verification code sent to your email.',
      ),
    ).toBeVisible();
    await expect(codeInput).toHaveAttribute('type', 'text');
    await expect(codeInput).toHaveAttribute('placeholder', '000000');
    await expect(codeInput).toHaveAttribute('autocomplete', 'off');
    await expect(verifyButton).toBeDisabled();
    await expect(
      canvas.getByRole('button', { name: 'Resend Code' }),
    ).toBeVisible();
  },
};

/**
 * Verifies that incomplete and non-numeric codes remain invalid and visible
 * validation prevents verification.
 */
export const InvalidCode: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const codeInput = canvas.getByRole('textbox', {
      name: 'Verification Code',
    });
    const verifyButton = canvas.getByRole('button', { name: 'Verify Code' });

    verifiedSpy.mockClear();
    await userEvent.type(codeInput, '12345');
    await userEvent.tab();

    await expect(canvas.getByRole('alert')).toBeVisible();
    await expect(canvas.getByRole('alert')).toHaveTextContent(
      'Enter the 6-digit code provided.',
    );
    await expect(verifyButton).toBeDisabled();

    await userEvent.click(codeInput);
    await userEvent.clear(codeInput);
    await userEvent.type(codeInput, '12345a');
    await expect(verifyButton).toBeDisabled();
    await expect(verifiedSpy).not.toHaveBeenCalled();
  },
};

/**
 * Verifies that exactly six numeric digits enable verification and are
 * emitted through the component's public output.
 */
export const SuccessfulVerification: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const codeInput = canvas.getByRole('textbox', {
      name: 'Verification Code',
    });
    const verifyButton = canvas.getByRole('button', { name: 'Verify Code' });

    verifiedSpy.mockClear();
    await userEvent.type(codeInput, '654321');

    await expect(verifyButton).toBeEnabled();
    await userEvent.click(verifyButton);
    await expect(verifiedSpy).toHaveBeenCalledWith('654321');
  },
};
