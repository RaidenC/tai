import { Component, input, viewChild, ElementRef, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { LoginFormComponent } from '@tai/ui-design-system';

const SYSTEM_CONFIG = {
  gatewayPort: 5217,
  identityPath: '/identity'
};

/**
 * The Login component handles the user interface for authenticating users.
 * 
 * In this POC, it captures OIDC parameters from the URL and presents a 
 * form that posts directly to the Backend API.
 */
@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, LoginFormComponent],
  templateUrl: './login.html',
  styleUrl: './login.scss',
})
export class Login {
  /**
   * Input Signal: Captured automatically from the URL query string (e.g., ?returnUrl=...)
   * because we enabled 'withComponentInputBinding()' in app.config.ts.
   * 
   * This is where OpenIddict expects us to return the user after a successful login.
   */
  public readonly returnUrl = input<string>('');

  /**
   * Input Signal: Captured from the URL query string (e.g., ?error=...)
   */
  public readonly error = input<string>('');

  /**
   * Computed Error Message:
   * Note how we stay generic to prevent leaking if a user exists in another bank.
   */
  protected readonly errorMessage = computed(() => {
    switch (this.error()) {
      case 'invalid_credentials':
        return 'Invalid login attempt. Please check your credentials and ensure you are at the correct institution URL.';
      case 'tenant_not_found':
        return 'The institution you are trying to access could not be identified.';
      default:
        return '';
    }
  });

  /**
   * ViewChild for the hidden native form used to perform the secure POST 
   * to the backend identity server.
   */
  protected readonly hiddenForm = viewChild<ElementRef<HTMLFormElement>>('hiddenPostForm');

  // Captured credentials from the secure LoginForm component
  protected credentials = { email: '', password: '' };

  /**
   * The URL of the .NET API endpoint that processes the login.
   * Pointing to the Gateway ensures the request is trusted.
   */
  protected get apiLoginUrl(): string {
    const host = window.location.hostname;
    return `http://${host}:${SYSTEM_CONFIG.gatewayPort}${SYSTEM_CONFIG.identityPath}/Account/Login`;
  }

  /**
   * Handles the submission from the Secure LoginForm.
   * 
   * STRATEGY:
   * 1. Receive validated credentials from the reactive component.
   * 2. Populate a hidden native HTML form.
   * 3. Submit the hidden form to perform a standard browser POST.
   * 
   * WHY:
   * This preserves the capability of the backend to set HTTP-Only session cookies 
   * and perform 302 redirects within the same browser context, which is 
   * essential for the OIDC flow in this POC.
   */
  public onLoginSubmitted(data: { email: string; password: string }): void {
    const form = this.hiddenForm()?.nativeElement;
    if (form) {
      // Manually set the values to avoid any Angular change detection race conditions
      // across different browsers (which was causing empty credentials to be sent).
      const usernameInput = form.elements.namedItem('username') as HTMLInputElement;
      const passwordInput = form.elements.namedItem('password') as HTMLInputElement;
      
      if (usernameInput) usernameInput.value = data.email;
      if (passwordInput) passwordInput.value = data.password;
      
      form.submit();
    }
  }
}
