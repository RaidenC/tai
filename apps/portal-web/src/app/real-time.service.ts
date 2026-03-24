import { Injectable, inject, OnDestroy } from '@angular/core';
import { HubConnection, HubConnectionBuilder, HubConnectionState, LogLevel } from '@microsoft/signalr';
import { AuthService } from './auth.service';
import { BehaviorSubject } from 'rxjs';

/**
 * RealTimeService
 * 
 * Manages the SignalR connection to the backend NotificationHub.
 * Handles real-time events like 'PrivilegesChanged'.
 */
@Injectable({
  providedIn: 'root'
})
export class RealTimeService implements OnDestroy {
  private readonly authService = inject(AuthService);
  private hubConnection: HubConnection | null = null;
  private readonly _connectionStatus$ = new BehaviorSubject<HubConnectionState>(HubConnectionState.Disconnected);
  
  public readonly connectionStatus$ = this._connectionStatus$.asObservable();

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

    this.hubConnection.on('PrivilegesChanged', () => {
      console.warn('RealTimeService: Privileges have changed. Triggering re-authentication.');
      // When privileges change, we need to refresh the OIDC session to get a new token/claims.
      // This is the core requirement for Phase 6.
      this.authService.checkAuth().subscribe();
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
