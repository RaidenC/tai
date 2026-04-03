import { Injectable, signal, computed } from '@angular/core';
import { AuditLogDetails } from '../models/security-event.model';

const MAX_BUFFER_SIZE = 50;
const MAX_IDEMPOTENCY_CACHE = 1000;

@Injectable({
  providedIn: 'root'
})
export class NotificationSignalStore {
  private readonly _eventBuffer = signal<AuditLogDetails[]>([]);
  private readonly seenEventIds = new Set<string>();

  readonly eventBuffer = this._eventBuffer.asReadonly();

  readonly latestEvent = computed(() => {
    const buffer = this._eventBuffer();
    return buffer.length > 0 ? buffer[buffer.length - 1] : null;
  });

  addEvent(event: AuditLogDetails): void {
    if (this.seenEventIds.has(event.id)) {
      console.log(`NotificationSignalStore: Duplicate event ${event.id} skipped`);
      return;
    }

    this.seenEventIds.add(event.id);

    this._eventBuffer.update((buffer: AuditLogDetails[]) => {
      const newBuffer: AuditLogDetails[] = [...buffer, event];
      if (newBuffer.length > MAX_BUFFER_SIZE) {
        return newBuffer.slice(-MAX_BUFFER_SIZE);
      }
      return newBuffer;
    });

    if (this.seenEventIds.size > MAX_IDEMPOTENCY_CACHE) {
      const buffer = this._eventBuffer();
      this.seenEventIds.clear();
      buffer.forEach((e: AuditLogDetails) => this.seenEventIds.add(e.id));
    }
  }

  removeEvent(eventId: string): void {
    this._eventBuffer.update((buffer: AuditLogDetails[]) =>
      buffer.filter((e: AuditLogDetails) => e.id !== eventId)
    );
  }

  clearBuffer(): void {
    this._eventBuffer.set([]);
    this.seenEventIds.clear();
  }
}