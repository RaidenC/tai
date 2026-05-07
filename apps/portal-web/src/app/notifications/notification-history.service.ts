import { DestroyRef, Injectable, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { HttpClient } from '@angular/common/http';
import { BehaviorSubject, EMPTY, Subject, catchError, debounceTime, distinctUntilChanged, filter, map, switchMap, tap, timeout } from 'rxjs';
import { AuthService, User } from '../auth.service';
import { AuditLogDetails } from '../models/security-event.model';
import { NotificationSignalStore } from '../store/notification-signal.store';
import { mapAuditLogToNotification } from './notification.mapper';

const RECENT_LIMIT = 50;
const HYDRATION_TIMEOUT_MS = 10_000;
const RETRY_DEBOUNCE_MS = 1_000;
const RETRY_WINDOW_MS = 30_000;
const MAX_RETRIES_PER_WINDOW = 3;

@Injectable({ providedIn: 'root' })
export class NotificationHistoryService {
  private readonly authService = inject(AuthService);
  private readonly http = inject(HttpClient);
  private readonly store = inject(NotificationSignalStore);
  private readonly destroyRef = inject(DestroyRef);
  private readonly retryRequests$ = new Subject<void>();
  private readonly hydratedTenants = new Set<string>();
  private readonly retryAttemptsByTenant = new Map<string, number[]>();
  private currentTenantId: string | null = null;

  constructor() {
    this.authService.user$.pipe(
      takeUntilDestroyed(this.destroyRef),
      map(user => user?.tenantId ?? null),
      tap(tenantId => this.handleTenantBoundary(tenantId)),
      filter((tenantId): tenantId is string => !!tenantId),
      // Note: This filter reads from hydratedTenants which is mutated elsewhere.
      // RxJS operators execute serially within a subscription, so this is safe:
      // each emission is processed completely before the next one is handled.
      filter(tenantId => !this.hydratedTenants.has(tenantId)),
      switchMap(tenantId => this.hydrateTenant(tenantId))
    ).subscribe();

    this.retryRequests$.pipe(
      takeUntilDestroyed(this.destroyRef),
      debounceTime(RETRY_DEBOUNCE_MS),
      switchMap(() => {
        if (!this.currentTenantId) {
          this.store.setHydrating(false);
          this.store.setHydrationError('Unable to verify notification tenant.');
          return EMPTY;
        }
        if (!this.canRetry(this.currentTenantId)) {
          this.store.setHydrationError('Retry limit reached. Try again shortly.');
          return EMPTY;
        }
        this.hydratedTenants.delete(this.currentTenantId);
        return this.hydrateTenant(this.currentTenantId);
      })
    ).subscribe();
  }

  retry(): void {
    this.retryRequests$.next();
  }

  private handleTenantBoundary(tenantId: string | null): void {
    const previousTenantId = this.currentTenantId;
    this.currentTenantId = tenantId;

    // Clear hydrated state when tenant changes (not on initial null -> valid tenant)
    if (previousTenantId !== null && previousTenantId !== tenantId) {
      this.store.clearForAuthBoundaryChange();
      // Only delete the previous tenant - the incoming tenant hasn't been hydrated yet
      this.hydratedTenants.delete(previousTenantId);
    }

    // Clear retry attempts when tenant changes
    if (previousTenantId !== tenantId) {
      this.retryAttemptsByTenant.clear();
    }

    if (!tenantId) {
      this.store.setHydrating(false);
      this.store.setHydrationError('Unable to verify notification tenant.');
    }
  }

  private hydrateTenant(tenantId: string) {
    this.store.setHydrating(true);
    this.store.setHydrationError(null);

    return this.http.get<AuditLogDetails[]>(`/api/AuditLogs/recent?limit=${RECENT_LIMIT}`, { withCredentials: true }).pipe(
      timeout(HYDRATION_TIMEOUT_MS),
      tap(rows => this.applyHydrationRows(rows, tenantId)),
      catchError(error => {
        this.store.setHydrationError(this.mapHydrationError(error));
        this.store.setHydrating(false);
        return EMPTY;
      })
    );
  }

  private applyHydrationRows(rows: AuditLogDetails[], expectedTenantId: string): void {
    if (this.currentTenantId !== expectedTenantId) {
      return;
    }

    const mapped = rows
      .map(row => mapAuditLogToNotification(row, {
        source: 'history',
        expectedEventId: row.id,
        expectedTenantId,
      }))
      .filter(notification => notification !== null);

    if (rows.length > 0 && mapped.length === 0) {
      this.store.setHydrationError('Unable to load recent notifications');
      this.store.setHydrating(false);
      return;
    }

    this.store.addNotifications(mapped);
    this.store.markHydrated();
    this.store.setHydrationError(null);
    this.store.setHydrating(false);
    // Re-verify tenant is still current before marking hydrated (handles race condition)
    if (this.currentTenantId === expectedTenantId) {
      this.hydratedTenants.add(expectedTenantId);
    }
  }

  private mapHydrationError(error: { status?: number }): string {
    if (error?.status === 403) return 'You do not have access to recent notifications.';
    if (error?.status === 429) return 'Recent notifications are temporarily rate limited.';
    return 'Unable to load recent notifications';
  }

  private canRetry(tenantId: string): boolean {
    const now = Date.now();
    const attempts = (this.retryAttemptsByTenant.get(tenantId) ?? [])
      .filter(timestamp => now - timestamp < RETRY_WINDOW_MS);

    if (attempts.length >= MAX_RETRIES_PER_WINDOW) {
      this.retryAttemptsByTenant.set(tenantId, attempts);
      return false;
    }

    attempts.push(now);
    this.retryAttemptsByTenant.set(tenantId, attempts);
    return true;
  }
}
