import { Component } from '@angular/core';
import { RouterModule } from '@angular/router';
import { WizardComponent, WizardStep } from '@tai/ui-design-system';

/**
 * Claim Wizard Wrapper
 *
 * This component wraps the generic WizardComponent and provides
 * the claim-specific step configuration.
 */
@Component({
  selector: 'bp-claim-wizard',
  standalone: true,
  imports: [WizardComponent, RouterModule],
  template: `
    <tai-wizard
      [steps]="steps"
      title="Disability Claim"
    >
      <router-outlet></router-outlet>
    </tai-wizard>
  `,
})
export class ClaimWizardComponent {
  steps: WizardStep[] = [
    { path: 'borrower-info', label: 'Borrower Info' },
    { path: 'incident-details', label: 'Incident Details' },
    { path: 'medical-providers', label: 'Medical Providers' },
    { path: 'review-sign', label: 'Review & Sign' },
  ];
}
