import { Injectable, isDevMode } from '@angular/core';

export type SecurityEventType =
  | 'PII_STRIPPED'
  | 'DRAFT_ENCRYPTED'
  | 'DRAFT_DECRYPTED'
  | 'ENCRYPT_FAILED'
  | 'DECRYPT_FAILED'
  | 'TAMPER_DETECTED'
  | 'DRAFT_TTL_EXPIRED'
  | 'CRYPTO_UNAVAILABLE';

export interface SecurityEvent {
  type: SecurityEventType;
  timestamp: string;
  details?: string;
}

@Injectable({ providedIn: 'root' })
export class SecurityLoggerService {
  private readonly events: SecurityEvent[] = [];

  log(type: SecurityEventType, details?: string): void {
    const event: SecurityEvent = {
      type,
      timestamp: new Date().toISOString(),
      details,
    };
    this.events.push(event);

    if (isDevMode()) {
      console.info('[SECURITY]', JSON.stringify(event));
    }
  }

  getEvents(): readonly SecurityEvent[] {
    return this.events;
  }
}
