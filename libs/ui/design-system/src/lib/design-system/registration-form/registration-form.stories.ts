import { Meta, StoryObj, moduleMetadata } from '@storybook/angular';
import { ReactiveFormsModule } from '@angular/forms';
import { userEvent, within, expect, waitFor } from 'storybook/test';
import { RegistrationFormComponent } from './registration-form';
import { SecureInputComponent } from '../secure-input/secure-input';
import { CommonModule } from '@angular/common';

/**
 * Storybook Configuration: RegistrationFormComponent
 *
 * Audit Proof: This story demonstrates that the registration form enforces
 * all required field invariants and strictly validates identity data
 * before allowing any self-service registration submission.
 */
const meta: Meta<RegistrationFormComponent> = {
  title: 'Identity/RegistrationForm',
  component: RegistrationFormComponent,
  decorators: [
    moduleMetadata({
      imports: [CommonModule, ReactiveFormsModule, SecureInputComponent],
    }),
  ],
  tags: ['autodocs'],
};

export default meta;
type Story = StoryObj<RegistrationFormComponent>;

export const Default: Story = {};

/**
 * Registration Validation Audit:
 * This interaction test verifies that the registration UI strictly
 * enforces field presence, email formatting, and password complexity
 * before enabling the registration submission path.
 */
export const RegistrationAudit: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const firstNameInput = canvas.getByLabelText(/First Name/i);
    const lastNameInput = canvas.getByLabelText(/Last Name/i);
    const emailInput = canvas.getByLabelText(/Email Address/i);
    const passwordInput = canvas.getByLabelText(/Password/i);
    const registerBtn = canvas.getByRole('button', {
      name: /Register Account/i,
    });

    // 1. Audit Initial State (Locked by Default)
    await expect(registerBtn).toBeDisabled();

    // 2. Audit Field Interaction (FirstName/LastName)
    await userEvent.type(firstNameInput, 'Jane', { delay: 10 });
    await userEvent.type(lastNameInput, 'Doe', { delay: 10 });
    await expect(registerBtn).toBeDisabled();

    // 3. Audit Email Validation Invariant
    await userEvent.type(emailInput, 'jane.doe', { delay: 10 });
    await userEvent.tab();
    await waitFor(() => {
      expect(
        canvas.getByText(/A valid email address is required/i),
      ).toBeInTheDocument();
    });
    await expect(registerBtn).toBeDisabled();

    // 4. Audit Password Complexity (Minimum Length)
    await userEvent.clear(emailInput);
    await userEvent.type(emailInput, 'jane.doe@example.com', { delay: 10 });
    await userEvent.type(passwordInput, '12345', { delay: 10 });
    await userEvent.tab();
    await waitFor(() => {
      expect(
        canvas.getByText(/Password must be at least 8 characters/i),
      ).toBeInTheDocument();
    });
    await expect(registerBtn).toBeDisabled();

    // 5. Audit Final Valid State Transition
    await userEvent.type(passwordInput, 'Secure678!', { delay: 10 });
    await userEvent.tab();

    await waitFor(() => {
      expect(registerBtn).toBeEnabled();
    });
  },
};
