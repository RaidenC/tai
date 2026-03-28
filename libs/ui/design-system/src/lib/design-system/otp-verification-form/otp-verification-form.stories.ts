import { Meta, StoryObj, moduleMetadata } from '@storybook/angular';
import { ReactiveFormsModule } from '@angular/forms';
import { userEvent, within, expect, waitFor } from 'storybook/test';
import { OtpVerificationFormComponent } from './otp-verification-form';
import { SecureInputComponent } from '../secure-input/secure-input';
import { CommonModule } from '@angular/common';

/**
 * Storybook Configuration: OtpVerificationFormComponent
 *
 * Audit Proof: This story demonstrates that the OTP verification UI
 * strictly enforces the 6-digit numeric pattern required for
 * identity activation.
 */
const meta: Meta<OtpVerificationFormComponent> = {
  title: 'Identity/OtpVerificationForm',
  component: OtpVerificationFormComponent,
  decorators: [
    moduleMetadata({
      imports: [CommonModule, ReactiveFormsModule, SecureInputComponent],
    }),
  ],
  tags: ['autodocs'],
};

export default meta;
type Story = StoryObj<OtpVerificationFormComponent>;

export const Default: Story = {};

/**
 * OTP Verification Invariant Audit:
 * This test verifies that the verification path is only enabled
 * when a complete 6-digit numeric code is provided.
 */
export const VerificationAudit: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const codeInput = canvas.getByLabelText(/Verification Code/i);
    const verifyBtn = canvas.getByRole('button', { name: /Verify Code/i });

    // 1. Audit Locked Initial State
    await expect(verifyBtn).toBeDisabled();

    // 2. Audit Partial Entry (Still Locked)
    await userEvent.type(codeInput, '12345', { delay: 20 });
    await userEvent.tab();
    await waitFor(() => {
      expect(
        canvas.getByText(/Enter the 6-digit code provided/i),
      ).toBeInTheDocument();
    });
    await expect(verifyBtn).toBeDisabled();

    // 3. Audit Full Correct Entry (Unlocks Path)
    await userEvent.type(codeInput, '6', { delay: 20 });
    await userEvent.tab();

    await waitFor(() => {
      expect(verifyBtn).not.toBeDisabled();
    });
    await expect(verifyBtn).toBeEnabled();
  },
};
