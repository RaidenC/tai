import { Component, signal } from '@angular/core';
import { RouterModule } from '@angular/router';
import { CryptoStorageService } from './claim/services/crypto-storage.service';
import { CryptoUnavailableComponent } from '@tai/ui-design-system';

@Component({
  imports: [RouterModule, CryptoUnavailableComponent],
  selector: 'bp-root',
  templateUrl: './app.html',
  styleUrl: './app.scss',
})
export class App {
  protected title = 'borrower-portal';
  protected cryptoAvailable = signal(CryptoStorageService.isAvailable());
}
