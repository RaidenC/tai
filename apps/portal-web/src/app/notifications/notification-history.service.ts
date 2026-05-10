import { DestroyRef, Injectable, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { HttpClient } from '@angular/common/http';
import { EMPTY, Subject, catchError, debounceTime, filter, switchMap, tap, timeout } from 'rxjs';
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
  private currentUser: Pick<User, 'id' | 'tenantId'> | null = null;

  constructor() {
    this.authService.user$.pipe(
      takeUntilDestroyed(this.destroyRef),
      tap(user => this.handleAuthBoundary(user)),
      filter((user): user is User => !!user && !!user.tenantId && !!user.id),
      filter(user => !this.hydratedTenants.has(this.getHydrationKey(user))),
      switchMap(user => this.hydrateTenant(user.tenantId!, user.id))
    ).subscribe();

    this.retryRequests$.pipe(
      takeUntilDestroyed(this.destroyRef),
      debounceTime(RETRY_DEBOUNCE_MS),
      switchMap(() => {
        const user = this.currentUser;
        if (!user?.tenantId || !user.id) {
          this.store.setHydrating(false);
          this.store.setHydrationError('Unable to verify notification tenant.');
          return EMPTY;
        }
        const hydrationKey = this.getHydrationKey({ tenantId: user.tenantId, id: user.id });
        if (!this.canRetry(hydrationKey)) {
          this.store.setHydrationError('Retry limit reached. Try again shortly.');
          return EMPTY;
        }
        this.hydratedTenants.delete(hydrationKey);
        return this.hydrateTenant(user.tenantId, user.id);
      })
    ).subscribe();
  }

  retry(): void {
    this.retryRequests$.next();
  }

  private handleAuthBoundary(user: User | null): void {
    const previousUser = this.currentUser;
    const previousKey = previousUser ? this.getHydrationKey(previousUser) : null;
    const nextKey = user?.tenantId && user?.id
      ? this.getHydrationKey({ tenantId: user.tenantId, id: user.id })
      : null;

    this.currentUser = nextKey ? { id: user!.id, tenantId: user!.tenantId } : null;

    // Clear hydrated state when tenant/user changes (not on initial null -> valid user)
    if (previousKey !== null && previousKey !== nextKey) {
      this.store.clearForAuthBoundaryChange();
      this.hydratedTenants.delete(previousKey);
    }

    // Clear retry attempts when auth boundary changes
    if (previousKey !== nextKey) {
      this.retryAttemptsByTenant.clear();
    }

    if (!user?.tenantId || !user.id) {
      this.store.setHydrating(false);
      this.store.setHydrationError('Unable to verify notification tenant.');
      return;
    }

    this.store.setLifecycleScope({ tenantId: user.tenantId, userId: user.id });
  }

  private getHydrationKey(user: Pick<User, 'tenantId' | 'id'>): string {
    return `${user.tenantId}:${user.id}`;
  }

  private hydrateTenant(tenantId: string, userId: string) {
    this.store.setHydrating(true);
    this.store.setHydrationError(null);

    return this.http.get<AuditLogDetails[]>(`/api/AuditLogs/recent?limit=${RECENT_LIMIT}`, { withCredentials: true }).pipe(
      timeout(HYDRATION_TIMEOUT_MS),
      tap(rows => this.applyHydrationRows(rows, tenantId, userId)),
      catchError(error => {
        this.store.setHydrationError(this.mapHydrationError(error));
        this.store.setHydrating(false);
        return EMPTY;
      })
    );
  }

  private applyHydrationRows(rows: AuditLogDetails[], expectedTenantId: string, expectedUserId: string): void {
    if (this.currentUser?.tenantId !== expectedTenantId || this.currentUser.id !== expectedUserId) {
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

    if (this.currentUser?.tenantId === expectedTenantId && this.currentUser.id === expectedUserId) {
      this.hydratedTenants.add(this.getHydrationKey({ tenantId: expectedTenantId, id: expectedUserId }));
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
