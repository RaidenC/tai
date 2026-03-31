import { Injectable, inject, OnDestroy, NgZone } from '@angular/core';
import { HubConnection, HubConnectionBuilder, HubConnectionState, LogLevel } from '@microsoft/signalr';
import { HttpClient } from '@angular/common/http';
import { AuthService } from './auth.service';
import { BehaviorSubject } from 'rxjs';
import { SecurityEventPayload, AuditLogDetails } from './models/security-event.model';

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

  private hubConnection: HubConnection | null = null;
  private readonly _connectionStatus$ = new BehaviorSubject<HubConnectionState>(HubConnectionState.Disconnected);

  public readonly connectionStatus$ = this._connectionStatus$.asObservable();

  /**
   * Subject for security events - components can subscribe to get full event details.
   * Uses Claim Check: receives event ID from SignalR, fetches full details via REST.
   */
  private readonly _securityEvents$ = new BehaviorSubject<AuditLogDetails | null>(null);
  public readonly securityEvents$ = this._securityEvents$.asObservable();

  constructor() {
    // Automatically manage connection based on authentication state
    this.authService.isAuthenticated$.subscribe(isAuthenticated => {
      if (isAuthenticated) {
        this.startConnection();
      } else {
        this.stopConnection();
      }
    });
  }

  ngOnDestroy(): void {
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
   * 3. Emit to subscribers
   */
  private handleSecurityEvent(payload: SecurityEventPayload): void {
    // Extract the event ID from the payload
    const eventId = payload.EventId;

    if (!eventId) {
      console.warn('RealTimeService: Received SecurityEvent without EventId');
      return;
    }

    // Fetch full details using Claim Check pattern
    this.fetchAuditLogDetails(eventId).subscribe({
      next: (details) => {
        // Emit the full details inside Angular zone to trigger change detection
        this.ngZone.run(() => {
          this._securityEvents$.next(details);
        });
      },
      error: (err) => {
        console.error('RealTimeService: Failed to fetch audit log details:', err);
      }
    });
  }

  /**
   * Fetch full audit log details from REST API (Claim Check).
   */
  private fetchAuditLogDetails(eventId: string) {
    const apiUrl = `http://${window.location.hostname}:5217/api/audit-logs/${eventId}`;
    return this.http.get<AuditLogDetails>(apiUrl, { withCredentials: true });
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