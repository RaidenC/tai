import { Meta, StoryObj } from '@storybook/angular';
import { expect, fn, type Mock, userEvent, within } from '@storybook/test';
import { RegistrationFormComponent } from './registration-form';

/**
 * Storybook Configuration: RegistrationFormComponent
 *
 * Audit Proof: This story demonstrates that the registration form enforces
 * all required field invariants and strictly validates identity data
 * before allowing any self-service registration submission.
 */
type RegistrationData = {
  email: string;
  firstName: string;
  lastName: string;
  password: string;
};

type RegistrationStoryArgs = {
  submitted: Mock<(data: RegistrationData) => void>;
};

const submittedSpy = fn<(data: RegistrationData) => void>();

const renderWithSubmittedSpy = (
  submitted: RegistrationStoryArgs['submitted'],
) => ({
  props: { submitted },
  template: `
    <tai-registration-form
      (submitted)="submitted($event)"></tai-registration-form>
  `,
});

const meta: Meta<RegistrationStoryArgs> = {
  title: 'Organisms/RegistrationForm',
  component: RegistrationFormComponent,
  args: {
    submitted: submittedSpy,
  },
  tags: ['autodocs'],
  render: () => renderWithSubmittedSpy(submittedSpy),
};

export default meta;
type Story = StoryObj<RegistrationStoryArgs>;

export const Default: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const passwordInput = canvas.getByLabelText(/Password/i);
    const registerButton = canvas.getByRole('button', {
      name: 'Register Account',
    });

    await expect(
      canvas.getByRole('heading', { name: 'Create Your Account' }),
    ).toBeVisible();
    await expect(canvas.getByLabelText(/First Name/i)).toBeVisible();
    await expect(canvas.getByLabelText(/Last Name/i)).toBeVisible();
    await expect(canvas.getByLabelText(/Email Address/i)).toBeVisible();
    await expect(passwordInput).toHaveAttribute('type', 'password');
    await expect(passwordInput).toHaveAttribute('autocomplete', 'new-password');
    await expect(registerButton).toBeDisabled();
    await expect(
      canvas.getByText(/By registering, you agree to our/),
    ).toBeVisible();
    await expect(
      canvas.getByRole('link', { name: 'Terms of Service' }),
    ).toBeVisible();
  },
};

/**
 * Verifies that each required field exposes its validation message after
 * interaction and keeps registration disabled.
 */
export const RequiredFields: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const firstNameInput = canvas.getByLabelText(/First Name/i);
    const lastNameInput = canvas.getByLabelText(/Last Name/i);
    const emailInput = canvas.getByLabelText(/Email Address/i);
    const passwordInput = canvas.getByLabelText(/Password/i);
    const registerButton = canvas.getByRole('button', {
      name: 'Register Account',
    });

    submittedSpy.mockClear();
    await userEvent.click(firstNameInput);
    await userEvent.tab();
    await userEvent.click(lastNameInput);
    await userEvent.tab();
    await userEvent.click(emailInput);
    await userEvent.tab();
    await userEvent.click(passwordInput);
    await userEvent.tab();

    await expect(canvas.getByText('First name is required.')).toBeVisible();
    await expect(canvas.getByText('Last name is required.')).toBeVisible();
    await expect(
      canvas.getByText('A valid email address is required.'),
    ).toBeVisible();
    await expect(
      canvas.getByText('Password must be at least 8 characters.'),
    ).toBeVisible();
    await expect(registerButton).toBeDisabled();
    await expect(submittedSpy).not.toHaveBeenCalled();
  },
};

/**
 * Verifies that an invalid email is visible and prevents registration.
 */
export const InvalidEmail: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const firstNameInput = canvas.getByLabelText(/First Name/i);
    const lastNameInput = canvas.getByLabelText(/Last Name/i);
    const emailInput = canvas.getByLabelText(/Email Address/i);
    const registerButton = canvas.getByRole('button', {
      name: 'Register Account',
    });

    submittedSpy.mockClear();
    await userEvent.type(firstNameInput, 'Jane');
    await userEvent.type(lastNameInput, 'Doe');
    await userEvent.type(emailInput, 'jane.doe');
    await userEvent.tab();

    await expect(
      canvas.getByText('A valid email address is required.'),
    ).toBeVisible();
    await expect(registerButton).toBeDisabled();
    await expect(submittedSpy).not.toHaveBeenCalled();
  },
};

/**
 * Verifies that a short password is visible and prevents registration.
 */
export const InvalidPassword: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const firstNameInput = canvas.getByLabelText(/First Name/i);
    const lastNameInput = canvas.getByLabelText(/Last Name/i);
    const emailInput = canvas.getByLabelText(/Email Address/i);
    const passwordInput = canvas.getByLabelText(/Password/i);
    const registerButton = canvas.getByRole('button', {
      name: 'Register Account',
    });

    submittedSpy.mockClear();
    await userEvent.type(firstNameInput, 'Jane');
    await userEvent.type(lastNameInput, 'Doe');
    await userEvent.type(emailInput, 'jane.doe@example.com');
    await userEvent.type(passwordInput, 'short');
    await userEvent.tab();

    await expect(
      canvas.getByText('Password must be at least 8 characters.'),
    ).toBeVisible();
    await expect(registerButton).toBeDisabled();
    await expect(submittedSpy).not.toHaveBeenCalled();
  },
};

/**
 * Verifies that valid registration data enables and submits the form.
 */
export const SuccessfulRegistration: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const firstNameInput = canvas.getByLabelText(/First Name/i);
    const lastNameInput = canvas.getByLabelText(/Last Name/i);
    const emailInput = canvas.getByLabelText(/Email Address/i);
    const passwordInput = canvas.getByLabelText(/Password/i);
    const registerButton = canvas.getByRole('button', {
      name: 'Register Account',
    });

    submittedSpy.mockClear();
    await userEvent.type(firstNameInput, 'John');
    await userEvent.type(lastNameInput, 'Doe');
    await userEvent.type(emailInput, 'customer@example.com');
    await userEvent.type(passwordInput, 'SecurePassword123!');

    await expect(registerButton).toBeEnabled();
    await userEvent.click(registerButton);
    await expect(submittedSpy).toHaveBeenCalledWith({
      email: 'customer@example.com',
      firstName: 'John',
      lastName: 'Doe',
      password: 'SecurePassword123!',
    });
  },
};
