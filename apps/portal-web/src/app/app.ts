import { Component, DestroyRef, OnInit, computed, inject } from '@angular/core';
import { takeUntilDestroyed, toObservable, toSignal } from '@angular/core/rxjs-interop';
import { RouterModule, Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import { AuthService } from './auth.service';
import { AppShellComponent, MenuItem, NotificationToggleComponent, NotificationPanelComponent, NotificationPanelItem, NotificationPanelConnectionState, ToastComponent, NotificationPanelService } from '@tai/ui-design-system';
import { OnboardingStore } from './features/onboarding/onboarding.store';
import { RealTimeService } from './real-time.service';
import { NotificationSignalStore } from './store/notification-signal.store';
import { NotificationHistoryService } from './notifications/notification-history.service';
import { CONNECTION_TEST_HOOK_SERVICE } from './notifications/connection-test-hook.token';
import { HubConnectionState } from '@microsoft/signalr';
import { combineLatest, map, of } from 'rxjs';
import { debounceTime, distinctUntilChanged, filter, pairwise, withLatestFrom } from 'rxjs/operators';

/**
 * Maps SignalR's 5 connection states to the panel's 3 UI states.
 * Connected -> 'connected'
 * Connecting/Reconnecting/Disconnecting -> 'reconnecting'
 * Disconnected -> 'disconnected'
 */
export function mapToNotificationPanelConnectionState(state: HubConnectionState): NotificationPanelConnectionState {
  switch (state) {
    case HubConnectionState.Connected:
      return 'connected';
    case HubConnectionState.Connecting:
    case HubConnectionState.Reconnecting:
    case HubConnectionState.Disconnecting:
      return 'reconnecting';
    case HubConnectionState.Disconnected:
    default:
      return 'disconnected';
  }
}

@Component({
    imports: [RouterModule, CommonModule, AppShellComponent, NotificationToggleComponent, NotificationPanelComponent, ToastComponent],
    selector: 'app-root',
    templateUrl: './app.html',
    styleUrl: './app.scss',
})
export class App implements OnInit {
    private readonly authService = inject(AuthService);
    protected readonly notificationHistoryService = inject(NotificationHistoryService);
    private readonly realTimeService = inject(RealTimeService); // Ensure RealTimeService is initialized
    private readonly destroyRef = inject(DestroyRef);
    public readonly router = inject(Router);
    protected readonly onboardingStore = inject(OnboardingStore);
    protected readonly notificationStore = inject(NotificationSignalStore);
    protected readonly notificationPanelService = inject(NotificationPanelService);
    private readonly testHook = inject(CONNECTION_TEST_HOOK_SERVICE, { optional: true });

    protected title = 'portal-web';
    protected user$ = this.authService.user$;
    protected isAuthenticated$ = this.authService.isAuthenticated$;

    // Maps NotificationItem to NotificationPanelItem for the NotificationPanel component
    protected readonly notificationPanelItems = computed<NotificationPanelItem[]>(() =>
        this.notificationStore.notifications().map(item => ({
            id: item.id,
            title: item.title,
            summary: item.summary,
            severity: item.severity,
            category: item.category,
            actor: item.actor,
            timestamp: item.timestamp,
            userId: item.userId,
            readAt: item.readAt,
            acknowledgedAt: item.acknowledgedAt,
        }))
    );

    // Connection state tracking
    private readonly connectionStatus$ = this.realTimeService.connectionStatus$;
    private readonly realTimeConnectionState = toSignal(this.connectionStatus$, {
      initialValue: HubConnectionState.Disconnected,
    });
    private readonly reconnectDebounceMs = 500;

    protected readonly connectionState = computed(() =>
      this.testHook?.connectionStateOverride() ?? this.realTimeConnectionState()
    );

    private readonly observedConnectionState$ = toObservable(this.connectionState);

    protected readonly notificationPanelConnectionState = computed(() =>
      mapToNotificationPanelConnectionState(this.connectionState())
    );

    /**
     * Exposes connection state for E2E test verification.
     * Returns the current connection state value.
     */
    connectionStateForTest(): HubConnectionState {
      return this.connectionState();
    }

    constructor() {
      // Install test hook if service is provided (only in test builds)
      this.testHook?.installHook();

      // Reconnect recovery stream: debounces rapid reconnect->connected transitions
      // and calls forceRetry() once per recovery sequence
      this.observedConnectionState$.pipe(
        distinctUntilChanged(),
        pairwise(),
        filter(([previous, current]) =>
          previous === HubConnectionState.Reconnecting && current === HubConnectionState.Connected
        ),
        debounceTime(this.reconnectDebounceMs),
        withLatestFrom(this.observedConnectionState$),
        filter(([, current]) => current === HubConnectionState.Connected),
        takeUntilDestroyed(this.destroyRef),
      ).subscribe(() => this.notificationHistoryService.forceRetry());
    }

    protected markNotificationRead(eventId: string): void {
        this.notificationStore.markRead(eventId);
    }

    protected markAllNotificationsRead(): void {
        this.notificationStore.markAllRead();
    }

    protected acknowledgeNotification(eventId: string): void {
        this.notificationStore.acknowledge(eventId);
    }

    private readonly allMenuItems: (MenuItem & { requiredPrivilege?: string })[] = [
        { label: 'Collections', link: '/collections', icon: '📥' },
        { label: 'Payments', link: '/payments', icon: '💰' },
        { label: 'Insurance', link: '/insurance', icon: '🛡️' },
        { label: 'Reports', link: '/reports', icon: '📊' },
        { label: 'Settings', link: '/settings', icon: '⚙️' },
        { label: 'Users', link: '/users', icon: '👥', requiredPrivilege: 'Portal.Users.Read' },
        { label: 'Privileges', link: '/admin/privileges', icon: '🛡️', requiredPrivilege: 'Portal.Privileges.Read' },
        { label: 'Approvals', link: '/admin/approvals', icon: '✅', requiredPrivilege: 'Portal.Approvals.Read' },
    ];

    protected menuItems$ = combineLatest(
      this.allMenuItems.map(item =>
        item.requiredPrivilege
          ? this.authService.hasPrivilege(item.requiredPrivilege).pipe(map(has => ({ item, has })))
          : combineLatest([of(item), of(true)]).pipe(map(([i, h]) => ({ item: i, has: h })))
      )
    ).pipe(
      map(results => results.filter(r => r.has).map(r => r.item))
    );

    ngOnInit() {
        this.authService.checkAuth().subscribe();
        this.isAuthenticated$.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(auth => {
          if (auth) {
            this.onboardingStore.loadPendingApprovals();
          }
        });
    }

    login() {
        this.authService.login();
    }

    logout() {
        this.authService.logout();
    }
}
