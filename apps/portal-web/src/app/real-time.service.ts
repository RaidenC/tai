import { Injectable, inject, OnDestroy, NgZone } from '@angular/core';
import { toObservable } from '@angular/core/rxjs-interop';
import { HubConnection, HubConnectionBuilder, HubConnectionState, LogLevel } from '@microsoft/signalr';
import { HttpClient } from '@angular/common/http';
import { AuthService } from './auth.service';
import { BehaviorSubject, firstValueFrom, Subscription } from 'rxjs';
import { SecurityEventPayload, AuditLogDetails } from './models/security-event.model';
import { NotificationSignalStore } from './store/notification-signal.store';
import { NotificationPanelService, ToastService } from '@tai/ui-design-system';
import { mapAuditLogToNotification } from './notifications/notification.mapper';
import { NOTIFICATION_TOAST_MESSAGES } from './notifications/notification-toast.constants';
import { NotificationItem } from './models/notification-item.model';

/**
 * RealTimeService
 *
 * Manages the SignalR connection to the backend NotificationHub.
 * Handles real-time security events with Claim Check pattern.
 *
 * IMPORTANT: SignalR events are wrapped in NgZone.runOutsideAngular() to prevent
 * change detection thrashing in zoneless Angular.
 */
@Injectable({
  providedIn: 'root'
})
export class RealTimeService implements OnDestroy {
  private readonly authService = inject(AuthService);
  private readonly http = inject(HttpClient);
  private readonly ngZone = inject(NgZone);
  private readonly store = inject(NotificationSignalStore);
  private readonly panelService = inject(NotificationPanelService);
  private readonly toastService = inject(ToastService);

  private hubConnection: HubConnection | null = null;
  private readonly _connectionStatus$ = new BehaviorSubject<HubConnectionState>(HubConnectionState.Disconnected);
  private readonly subscriptions = new Subscription();

  public readonly connectionStatus$ = this._connectionStatus$.asObservable();

  /**
   * Backward-compatible observable for security events.
   * Now backed by NotificationSignalStore but exposes the same API.
   * Components can subscribe to this, or use store.eventBuffer/store.latestEvent directly.
   */
  private readonly _securityEvents$ = new BehaviorSubject<AuditLogDetails | null>(null);
  public readonly securityEvents$ = this._securityEvents$.asObservable();

  constructor() {
    // Subscribe to store's latestEvent to keep backward-compatible observable in sync
    this.subscriptions.add(
      toObservable(this.store.latestEvent).subscribe(event => {
        this._securityEvents$.next(event);
      })
    );

    // Automatically manage connection based on authentication state
    this.subscriptions.add(
      this.authService.isAuthenticated$.subscribe(isAuthenticated => {
        if (isAuthenticated) {
          this.startConnection();
        } else {
          this.stopConnection();
        }
      })
    );
  }

  ngOnDestroy(): void {
    this.subscriptions.unsubscribe();
    this.stopConnection();
  }

  private startConnection(): void {
    if (this.hubConnection && this.hubConnection.state !== HubConnectionState.Disconnected) {
      return;
    }

    // JUNIOR RATIONALE: The hub URL must match the backend's MapHub configuration.
    // In our POC, the gateway (5217) proxies these requests.
    const hubUrl = `http://${window.location.hostname}:5217/hubs/notifications`;

    this.hubConnection = new HubConnectionBuilder()
      .withUrl(hubUrl, {
        // BFF logic: SignalR will automatically send the HttpOnly session cookie.
        withCredentials: true
      })
      .withAutomaticReconnect()
      .configureLogging(LogLevel.Information)
      .build();

    // Listen for privilege changes (existing functionality)
    this.hubConnection.on('PrivilegesChanged', () => {
      console.warn('RealTimeService: Privileges have changed. Triggering re-authentication.');
      // Run outside Angular zone to prevent unnecessary change detection cycles
      this.ngZone.runOutsideAngular(() => {
        this.authService.checkAuth().subscribe();
      });
    });

    // Listen for security events (Phase 5 - Claim Check pattern)
    // Run outside Angular zone to prevent change detection thrashing
    this.hubConnection.on('SecurityEvent', (payload: SecurityEventPayload) => {
      this.ngZone.runOutsideAngular(() => {
        console.log('RealTimeService: Received SecurityEvent', payload);
        this.handleSecurityEvent(payload);
      });
    });

    this.hubConnection.start()
      .then(() => {
        this._connectionStatus$.next(HubConnectionState.Connected);
        console.log('RealTimeService: SignalR Connected');
      })
      .catch(err => {
        this._connectionStatus$.next(HubConnectionState.Disconnected);
        console.error('RealTimeService: Error while starting connection: ' + err);
      });

    this.hubConnection.onreconnecting(() => this._connectionStatus$.next(HubConnectionState.Reconnecting));
    this.hubConnection.onreconnected(() => this._connectionStatus$.next(HubConnectionState.Connected));
    this.hubConnection.onclose(() => this._connectionStatus$.next(HubConnectionState.Disconnected));
  }

  /**
   * Handle security event using Claim Check pattern.
   * 1. Receive minimal payload from SignalR (eventId, timestamp)
   * 2. Fetch full details via REST API
   * 3. Map to NotificationItem and add to store
   */
  private async handleSecurityEvent(data: any): Promise<void> {
    console.log('RealTimeService: Full payload:', JSON.stringify(data));

    // Handle nested payload from SignalR - could be any case
    const eventType = data.EventType || data.eventType || data.EventType?.toString();
    const innerPayload = data.Payload || data.payload;

    // Get eventId - check all possible locations and cases
    let eventId: string | undefined;
    let reason: string | undefined;

    if (innerPayload) {
      // Check inside Payload object
      eventId = innerPayload.eventId || innerPayload.EventId || innerPayload.id || innerPayload.Id;
      reason = innerPayload.reason || innerPayload.Reason;
    } else {
      // Check at top level
      eventId = data.eventId || data.EventId || data.id || data.Id;
      reason = data.reason || data.Reason;
    }

    console.log('RealTimeService: eventId:', eventId, 'eventType:', eventType, 'reason:', reason);

    if (!eventId) {
      console.warn('RealTimeService: Received SecurityEvent without EventId');
      return;
    }

    // Get current tenant ID from AuthService for validation
    let tenantId: string | null = null;
    try {
      const user = await firstValueFrom(this.authService.user$);
      tenantId = user?.tenantId ?? null;
    } catch {
      // User stream may error if not authenticated
      tenantId = null;
    }

    if (!tenantId) {
      console.warn('RealTimeService: No tenant ID available, skipping notification');
      this.toastService.show(
        NOTIFICATION_TOAST_MESSAGES.tenantUnavailable,
        'warning'
      );
      return;
    }

    // Fetch full details using Claim Check pattern
    console.log('RealTimeService: Fetching audit log details for:', eventId);

    try {
      const details = await firstValueFrom(this.fetchAuditLogDetails(eventId));
      console.log('RealTimeService: Got details:', details);

      // Map AuditLogDetails to NotificationItem
      const notification = mapAuditLogToNotification(details, {
        source: 'signalr',
        expectedEventId: eventId,
        expectedTenantId: tenantId,
      });

      // If mapper returns null, skip (event ID or tenant mismatch)
      if (!notification) {
        console.warn('RealTimeService: Failed to map audit log to notification');
        return;
      }

      // Run inside Angular zone to trigger change detection
      this.ngZone.run(() => {
        // Use addNotification instead of addEvent
        this.store.addNotification(notification);
        this.panelService.setUnreadCount(this.store.eventBuffer().length);
        console.log('RealTimeService: Added notification to store:', notification);

        // Show toast for critical notifications using the notification title
        if (notification.severity === 'critical') {
          this.toastService.show(
            notification.title,
            'critical'
          );
        }
      });
    } catch (err) {
      console.error('RealTimeService: Failed to fetch audit log details:', err);
      this.toastService.show(
        NOTIFICATION_TOAST_MESSAGES.loadFailed,
        'warning'
      );
    }
  }

  /**
   * Fetch full audit log details from REST API (Claim Check).
   */
  private fetchAuditLogDetails(eventId: string) {
    const apiUrl = `/api/AuditLogs/${eventId}`;
    return this.http.get<AuditLogDetails>(apiUrl, {
      withCredentials: true
    });
  }

  private stopConnection(): void {
    if (this.hubConnection) {
      this.hubConnection.stop().then(() => {
        this.hubConnection = null;
        this._connectionStatus$.next(HubConnectionState.Disconnected);
      });
    }
  }

  /**
   * Manual trigger to send a notification (if needed for testing).
   */
  public sendNotification(message: string): Promise<void> {
    if (this.hubConnection?.state === HubConnectionState.Connected) {
      return this.hubConnection.invoke('SendNotification', message);
    }
    return Promise.reject('Not connected to hub');
  }
}
