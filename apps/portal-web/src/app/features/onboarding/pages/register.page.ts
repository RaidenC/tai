import { Component, inject, effect } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { RegistrationFormComponent } from '@tai/ui-design-system';
import { OnboardingStore } from '../onboarding.store';
import { RegistrationRequest } from '../onboarding.service';

@Component({
  selector: 'app-register-page',
  standalone: true,
  imports: [CommonModule, RegistrationFormComponent],
  template: `
    <div class="flex items-center justify-center min-h-[calc(100vh-64px)] bg-gray-50 px-4">
      <div class="w-full max-w-md">
        <tai-registration-form (submitted)="onRegister($event)"></tai-registration-form>
        
        @if (store.isError()) {
          <div class="mt-4 p-4 bg-red-50 border border-red-200 text-red-700 rounded-md text-sm">
            {{ store.errorMessage() }}
          </div>
        }
      </div>
    </div>
  `,
})
export class RegisterPage {
  protected readonly store = inject(OnboardingStore);
  private readonly router = inject(Router);

  constructor() {
    // Redirect to verify page after successful registration
    effect(() => {
      if (this.store.status() === 'Success') {
        this.store.reset();
        this.router.navigate(['/verify']);
      }
    });
  }

  onRegister(data: RegistrationRequest) {
    this.store.register(data);
  }
}
