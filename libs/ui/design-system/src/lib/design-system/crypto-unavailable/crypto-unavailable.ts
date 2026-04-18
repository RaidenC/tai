import { Component, input } from '@angular/core';

@Component({
  selector: 'tai-crypto-unavailable',
  standalone: true,
  template: `
    <div class="crypto-unavailable" data-testid="crypto-unavailable">
      <h2>Secure Connection Required</h2>
      <p>{{ message() }}</p>
      <p>Please ensure you are accessing this application over HTTPS.</p>
    </div>
  `,
  styles: `
    .crypto-unavailable {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      min-height: 60vh;
      text-align: center;
      padding: 2rem;
      color: #991b1b;
    }
    h2 {
      font-size: 1.5rem;
      font-weight: 600;
      margin-bottom: 1rem;
    }
    p {
      max-width: 32rem;
      line-height: 1.5;
      margin-bottom: 0.5rem;
    }
  `,
})
export class CryptoUnavailableComponent {
  message = input<string>(
    'This application requires a secure browser environment to protect your data.',
  );
}
