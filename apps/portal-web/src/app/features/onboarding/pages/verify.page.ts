import { Component, inject, effect } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { OtpVerificationFormComponent } from '@tai/ui-design-system';
import { OnboardingStore } from '../onboarding.store';

@Component({
  selector: 'app-verify-page',
  standalone: true,
  imports: [CommonModule, OtpVerificationFormComponent],
  template: `
    <div class="flex items-center justify-center min-h-[calc(100vh-64px)] bg-gray-50 px-4">
      <div class="w-full max-w-sm">
        <tai-otp-verification-form (verified)="onVerify($event)"></tai-otp-verification-form>
        
        @if (store.isError()) {
          <div class="mt-4 p-4 bg-red-50 border border-red-200 text-red-700 rounded-md text-sm">
            {{ store.errorMessage() }}
          </div>
        }
      </div>
    </div>
  `,
})
export class VerifyPage {
  protected readonly store = inject(OnboardingStore);
  private readonly router = inject(Router);

  constructor() {
    // Redirect to passkey setup after successful verification
    effect(() => {
      if (this.store.status() === 'Success') {
        this.store.reset();
        this.router.navigate(['/auth/passkey-setup']);
      }
    });
  }

  onVerify(code: string) {
    this.store.verify(code);
  }
}
