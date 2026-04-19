import { Component, inject, signal } from '@angular/core';
import { RouterModule } from '@angular/router';
import { CryptoStorageService } from './claim/services/crypto-storage.service';
import { SecurityLoggerService } from './claim/services/security-logger.service';
import { CryptoUnavailableComponent } from '@tai/ui-design-system';

@Component({
  imports: [RouterModule, CryptoUnavailableComponent],
  selector: 'bp-root',
  templateUrl: './app.html',
  styleUrl: './app.scss',
})
export class App {
  private readonly logger = inject(SecurityLoggerService);

  protected title = 'borrower-portal';
  protected cryptoAvailable = signal(CryptoStorageService.isAvailable());

  constructor() {
    if (!this.cryptoAvailable()) {
      this.logger.log(
        'CRYPTO_UNAVAILABLE',
        'crypto.subtle unavailable — application gated behind CryptoUnavailableComponent',
      );
    }
  }
}
