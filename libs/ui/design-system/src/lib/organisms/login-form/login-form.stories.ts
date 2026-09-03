import { Meta, StoryObj } from '@storybook/angular';
import { expect, fn, type Mock, userEvent, within } from '@storybook/test';
import { LoginFormComponent } from './login-form';

/**
 * Storybook Configuration: LoginFormComponent
 *
 * Audit Proof: This story demonstrates that the login form strictly enforces
 * identity invariants and utilizes hardware-safe input attributes before
 * allowing any data transmission.
 */
type LoginCredentials = {
  email: string;
  password: string;
};

type LoginFormStoryArgs = {
  submitted: Mock<(credentials: LoginCredentials) => void>;
};

const submittedSpy = fn<(credentials: LoginCredentials) => void>();

const renderWithSubmittedSpy = (
  submitted: LoginFormStoryArgs['submitted'],
) => ({
  props: { submitted },
  template: `
    <tai-login-form (submitted)="submitted($event)"></tai-login-form>
  `,
});

const meta: Meta<LoginFormStoryArgs> = {
  title: 'Organisms/LoginForm',
  component: LoginFormComponent,
  args: {
    submitted: submittedSpy,
  },
  tags: ['autodocs'],
  render: () => renderWithSubmittedSpy(submittedSpy),
};

export default meta;
type Story = StoryObj<LoginFormStoryArgs>;

export const Default: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const emailInput = canvas.getByRole('textbox', {
      name: 'Corporate Email',
    });
    const passwordInput = canvas.getByLabelText(/Password/);
    const submitButton = canvas.getByRole('button', {
      name: 'Sign In to Portal',
    });

    await expect(emailInput).toHaveAttribute('type', 'email');
    await expect(emailInput).toHaveAttribute('autocomplete', 'email');
    await expect(passwordInput).toHaveAttribute('type', 'password');
    await expect(passwordInput).toHaveAttribute(
      'autocomplete',
      'current-password',
    );
    await expect(
      canvas.getByText('Use your company email address.'),
    ).toBeVisible();
    await expect(submitButton).toBeDisabled();
  },
};

/**
 * Verifies that an invalid email is reported after the field is blurred and
 * that invalid credentials cannot be submitted.
 */
export const InvalidEmail: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const emailInput = canvas.getByRole('textbox', {
      name: 'Corporate Email',
    });
    const submitButton = canvas.getByRole('button', {
      name: 'Sign In to Portal',
    });

    submittedSpy.mockClear();
    await userEvent.type(emailInput, 'invalid-identity');
    await userEvent.tab();

    await expect(
      canvas.getByText('A valid corporate email is required.'),
    ).toBeVisible();
    await expect(submitButton).toBeDisabled();
    await expect(submittedSpy).not.toHaveBeenCalled();
  },
};

/**
 * Verifies that the password length requirement is visible to the user and
 * prevents submission until the password is valid.
 */
export const InvalidPassword: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const emailInput = canvas.getByRole('textbox', {
      name: 'Corporate Email',
    });
    const passwordInput = canvas.getByLabelText(/Password/);
    const submitButton = canvas.getByRole('button', {
      name: 'Sign In to Portal',
    });

    submittedSpy.mockClear();
    await userEvent.type(emailInput, 'admin@tai.com');
    await userEvent.type(passwordInput, 'short');
    await userEvent.tab();

    await expect(
      canvas.getByText('Password must be at least 8 characters.'),
    ).toBeVisible();
    await expect(submitButton).toBeDisabled();
    await expect(submittedSpy).not.toHaveBeenCalled();
  },
};

/**
 * Verifies the complete public submission flow with valid credentials.
 */
export const SuccessfulSubmission: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const emailInput = canvas.getByRole('textbox', {
      name: 'Corporate Email',
    });
    const passwordInput = canvas.getByLabelText(/Password/);
    const submitButton = canvas.getByRole('button', {
      name: 'Sign In to Portal',
    });

    submittedSpy.mockClear();
    await userEvent.type(emailInput, 'admin@tai.com');
    await userEvent.type(passwordInput, 'SecurePass123!');

    await expect(submitButton).toBeEnabled();
    await userEvent.click(submitButton);

    await expect(submittedSpy).toHaveBeenCalledWith({
      email: 'admin@tai.com',
      password: 'SecurePass123!',
    });
  },
};
