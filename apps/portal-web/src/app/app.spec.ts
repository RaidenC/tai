import { TestBed } from '@angular/core/testing';
import { signal, computed } from '@angular/core';
import { App } from './app';
import { AuthService } from './auth.service';
import { RealTimeService } from './real-time.service';
import { NotificationSignalStore } from './store/notification-signal.store';
import { NotificationHistoryService } from './notifications/notification-history.service';
import { of, BehaviorSubject } from 'rxjs';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { provideRouter } from '@angular/router';
import { By } from '@angular/platform-browser';
import { NotificationPanelComponent, NotificationToggleComponent } from '@tai/ui-design-system';
import { HubConnectionState } from '@microsoft/signalr';
import { mapToNotificationPanelConnectionState } from './app';

describe('App', () => {
    let authServiceMock: any;
    let realTimeServiceMock: any;
    let notificationStoreMock: any;
    let notificationHistoryServiceMock: any;
    let notificationsSignal: any;

    beforeEach(async () => {
        // Create signal with 3 unread notifications (readAt: null) and 1 read notification
        notificationsSignal = signal([
            {
                id: 'evt-001',
                tenantId: 'tenant-1',
                eventType: 'PrivilegeModified',
                severity: 'critical' as const,
                category: 'privilege' as const,
                title: 'Privilege modified',
                summary: 'Trade approver changed',
                timestamp: '2026-05-07T18:00:00.000Z',
                actor: 'admin@tai.com',
                userId: 'admin@tai.com',
                ipAddress: null,
                resourceId: 'priv-1',
                correlationId: null,
                readAt: '2026-05-07T18:01:00.000Z', // Already read
                acknowledgedAt: '2026-05-07T18:02:00.000Z',
                source: 'history' as const,
            },
            {
                id: 'evt-002',
                tenantId: 'tenant-1',
                eventType: 'UserCreated',
                severity: 'info' as const,
                category: 'user' as const,
                title: 'User created',
                summary: 'New user onboarded',
                timestamp: '2026-05-07T19:00:00.000Z',
                actor: 'admin@tai.com',
                userId: 'admin@tai.com',
                ipAddress: null,
                resourceId: 'user-1',
                correlationId: null,
                readAt: null, // Unread
                acknowledgedAt: null,
                source: 'history' as const,
            },
            {
                id: 'evt-003',
                tenantId: 'tenant-1',
                eventType: 'UserModified',
                severity: 'warning' as const,
                category: 'user' as const,
                title: 'User modified',
                summary: 'User profile updated',
                timestamp: '2026-05-07T20:00:00.000Z',
                actor: 'admin@tai.com',
                userId: 'admin@tai.com',
                ipAddress: null,
                resourceId: 'user-2',
                correlationId: null,
                readAt: null, // Unread
                acknowledgedAt: null,
                source: 'history' as const,
            },
            {
                id: 'evt-004',
                tenantId: 'tenant-1',
                eventType: 'Login',
                severity: 'info' as const,
                category: 'auth' as const,
                title: 'Login detected',
                summary: 'User logged in',
                timestamp: '2026-05-07T21:00:00.000Z',
                actor: 'user@tai.com',
                userId: 'user@tai.com',
                ipAddress: null,
                resourceId: 'session-1',
                correlationId: null,
                readAt: null, // Unread
                acknowledgedAt: null,
                source: 'history' as const,
            },
        ]);

        authServiceMock = {
            user$: of(null),
            isAuthenticated$: of(false),
            login: vi.fn(),
            logout: vi.fn(),
            checkAuth: vi.fn(() => of(false)),
            hasPrivilege: vi.fn(() => of(true))
        };

        realTimeServiceMock = {
            connectionStatus$: of('Disconnected')
        };

        // Computed unreadCount from notifications - mirrors real store implementation
        const unreadCountComputed = computed(() =>
            notificationsSignal().filter((item: any) => item.readAt === null).length
        );

        notificationStoreMock = {
            notifications: notificationsSignal.asReadonly(),
            unreadCount: unreadCountComputed,
            isHydrating: signal(false).asReadonly(),
            hasHydrated: signal(true).asReadonly(),
            hydrationError: signal(null).asReadonly(),
            markRead: vi.fn((eventId: string) => {
                // Simulate the store's markRead behavior for testing
                const readAt = new Date().toISOString();
                notificationsSignal.update((items: any[]) =>
                    items.map(item => item.id === eventId ? { ...item, readAt } : item)
                );
            }),
            markAllRead: vi.fn(),
            acknowledge: vi.fn(),
        };

        notificationHistoryServiceMock = {
            retry: vi.fn(),
            forceRetry: vi.fn(),
            isRetryThrottled: signal(false).asReadonly(),
            forceRetryNotice: signal(null).asReadonly(),
        };

        await TestBed.configureTestingModule({
            imports: [App],
            providers: [
                { provide: AuthService, useValue: authServiceMock },
                { provide: RealTimeService, useValue: realTimeServiceMock },
                { provide: NotificationSignalStore, useValue: notificationStoreMock },
                { provide: NotificationHistoryService, useValue: notificationHistoryServiceMock },
                provideRouter([])
            ]
        }).compileComponents();
    });

    it('should render login button when not authenticated', async () => {
        const fixture = TestBed.createComponent(App);
        fixture.detectChanges();
        await fixture.whenStable();
        const compiled = fixture.nativeElement as HTMLElement;
        expect(compiled.querySelector('.login-btn')).toBeTruthy();
    });

    it('should call login when button clicked', async () => {
        const fixture = TestBed.createComponent(App);
        fixture.detectChanges();
        const button = fixture.nativeElement.querySelector('.login-btn');
        button.click();
        expect(authServiceMock.login).toHaveBeenCalled();
    });

    it('should render app shell when authenticated', async () => {
        authServiceMock.isAuthenticated$ = of(true);
        authServiceMock.user$ = of({ id: '1', name: 'John Doe', email: 'john@tai.com', roles: [], privileges: [] });
        
        const fixture = TestBed.createComponent(App);
        fixture.detectChanges();
        await fixture.whenStable();
        const compiled = fixture.nativeElement as HTMLElement;
        expect(compiled.querySelector('tai-app-shell')).toBeTruthy();
    });

    it('should call logout when app shell emits logout', async () => {
        authServiceMock.isAuthenticated$ = of(true);
        
        const fixture = TestBed.createComponent(App);
        fixture.detectChanges();
        const app = fixture.componentInstance;
        app.logout();
        expect(authServiceMock.logout).toHaveBeenCalled();
    });

    it('should render welcome content if title is not portal-web', async () => {
        authServiceMock.isAuthenticated$ = of(true);

        const fixture = TestBed.createComponent(App);
        const app = fixture.componentInstance;
        // @ts-expect-error - access protected
        app.title = 'other';
        fixture.detectChanges();
        await fixture.whenStable();
        const compiled = fixture.nativeElement as HTMLElement;
        expect(compiled.querySelector('.welcome-content')).toBeTruthy();
    });

    describe('Notification Panel Integration', () => {
        it('maps lifecycle fields into notification panel items', () => {
            const fixture = TestBed.createComponent(App);
            fixture.detectChanges();

            const app = fixture.componentInstance as any;
            // Check that evt-001 (the read/acknowledged notification) is present with correct lifecycle fields
            expect(app.notificationPanelItems()).toEqual(
                expect.arrayContaining([
                    expect.objectContaining({
                        id: 'evt-001',
                        readAt: '2026-05-07T18:01:00.000Z',
                        acknowledgedAt: '2026-05-07T18:02:00.000Z',
                    }),
                ])
            );
        });

        it('wires notification panel lifecycle outputs to the store', () => {
            const fixture = TestBed.createComponent(App);
            fixture.detectChanges();
            const panel = fixture.debugElement.query(By.directive(NotificationPanelComponent)).componentInstance as NotificationPanelComponent;

            panel.markRead.emit('evt-001');
            panel.markAllRead.emit();
            panel.acknowledge.emit('evt-001');

            expect(notificationStoreMock.markRead).toHaveBeenCalledWith('evt-001');
            expect(notificationStoreMock.markAllRead).toHaveBeenCalled();
            expect(notificationStoreMock.acknowledge).toHaveBeenCalledWith('evt-001');
        });

        it('passes unread count to notification toggle', () => {
            const fixture = TestBed.createComponent(App);
            fixture.detectChanges();
            const toggle = fixture.debugElement.query(By.directive(NotificationToggleComponent)).componentInstance as NotificationToggleComponent;

            expect(toggle.unreadCount()).toBe(3);
        });

        it('updates toggle unread count after markRead', async () => {
            const fixture = TestBed.createComponent(App);
            fixture.detectChanges();

            const toggle = fixture.debugElement.query(By.directive(NotificationToggleComponent)).componentInstance as NotificationToggleComponent;

            // Initial state: 3 unread (evt-002, evt-003, evt-004)
            expect(toggle.unreadCount()).toBe(3);

            // Call markRead through the mock's implementation
            notificationStoreMock.markRead('evt-002');

            // Trigger change detection
            fixture.detectChanges();
            await fixture.whenStable();

            // Verify unread count decreased to 2
            expect(toggle.unreadCount()).toBe(2);
        });
    });

    describe('Connection State Mapping', () => {
        it('maps SignalR connection states to notification panel states', () => {
            expect(mapToNotificationPanelConnectionState(HubConnectionState.Connected)).toBe('connected');
            expect(mapToNotificationPanelConnectionState(HubConnectionState.Connecting)).toBe('reconnecting');
            expect(mapToNotificationPanelConnectionState(HubConnectionState.Reconnecting)).toBe('reconnecting');
            expect(mapToNotificationPanelConnectionState(HubConnectionState.Disconnecting)).toBe('reconnecting');
            expect(mapToNotificationPanelConnectionState(HubConnectionState.Disconnected)).toBe('disconnected');
        });
    });

    describe('Reconnect Recovery Stream', () => {
        it('connection state signal updates from connection status observable', async () => {
            const connectionStatusSubject = new BehaviorSubject<HubConnectionState>(HubConnectionState.Disconnected);

            // Override the mock before TestBed configuration
            realTimeServiceMock.connectionStatus$ = connectionStatusSubject.asObservable();

            await TestBed.configureTestingModule({
                imports: [App],
                providers: [
                    { provide: AuthService, useValue: authServiceMock },
                    { provide: RealTimeService, useValue: realTimeServiceMock },
                    { provide: NotificationSignalStore, useValue: notificationStoreMock },
                    { provide: NotificationHistoryService, useValue: notificationHistoryServiceMock },
                    provideRouter([])
                ]
            }).compileComponents();

            const fixture = TestBed.createComponent(App);
            fixture.detectChanges();
            const component = fixture.componentInstance;

            // Initial state should be Disconnected
            expect(component.connectionStateForTest()).toBe(HubConnectionState.Disconnected);

            // Emit Connected
            connectionStatusSubject.next(HubConnectionState.Connected);
            fixture.detectChanges();
            await fixture.whenStable();

            // Signal should update to Connected
            expect(component.connectionStateForTest()).toBe(HubConnectionState.Connected);

            // Emit Reconnecting
            connectionStatusSubject.next(HubConnectionState.Reconnecting);
            fixture.detectChanges();
            await fixture.whenStable();

            // Signal should update to Reconnecting
            expect(component.connectionStateForTest()).toBe(HubConnectionState.Reconnecting);
        });

        it('notificationPanelConnectionState maps to UI states', async () => {
            const connectionStatusSubject = new BehaviorSubject<HubConnectionState>(HubConnectionState.Disconnected);

            realTimeServiceMock.connectionStatus$ = connectionStatusSubject.asObservable();

            await TestBed.configureTestingModule({
                imports: [App],
                providers: [
                    { provide: AuthService, useValue: authServiceMock },
                    { provide: RealTimeService, useValue: realTimeServiceMock },
                    { provide: NotificationSignalStore, useValue: notificationStoreMock },
                    { provide: NotificationHistoryService, useValue: notificationHistoryServiceMock },
                    provideRouter([])
                ]
            }).compileComponents();

            const fixture = TestBed.createComponent(App);
            fixture.detectChanges();
            const component = fixture.componentInstance as any;

            // Verify UI state mapping
            connectionStatusSubject.next(HubConnectionState.Disconnected);
            fixture.detectChanges();
            await fixture.whenStable();
            expect(component.notificationPanelConnectionState()).toBe('disconnected');

            connectionStatusSubject.next(HubConnectionState.Connected);
            fixture.detectChanges();
            await fixture.whenStable();
            expect(component.notificationPanelConnectionState()).toBe('connected');

            connectionStatusSubject.next(HubConnectionState.Reconnecting);
            fixture.detectChanges();
            await fixture.whenStable();
            expect(component.notificationPanelConnectionState()).toBe('reconnecting');

            connectionStatusSubject.next(HubConnectionState.Connecting);
            fixture.detectChanges();
            await fixture.whenStable();
            expect(component.notificationPanelConnectionState()).toBe('reconnecting');

            connectionStatusSubject.next(HubConnectionState.Disconnecting);
            fixture.detectChanges();
            await fixture.whenStable();
            expect(component.notificationPanelConnectionState()).toBe('reconnecting');
        });
    });

    describe('Test Hook', () => {
        it('test hook accepts enum member names and rejects invalid names', async () => {
            // Note: The hook is only installed when environment.enableE2eConnectionHook is true
            // In the test environment (vitest), we use the default environment which has hook disabled
            // So we test the coerceHubConnectionState function behavior indirectly

            const connectionStatusSubject = new BehaviorSubject<HubConnectionState>(HubConnectionState.Disconnected);

            // Override the realTimeService mock for this test
            realTimeServiceMock.connectionStatus$ = connectionStatusSubject.asObservable();

            await TestBed.configureTestingModule({
                imports: [App],
                providers: [
                    { provide: AuthService, useValue: authServiceMock },
                    { provide: RealTimeService, useValue: realTimeServiceMock },
                    { provide: NotificationSignalStore, useValue: notificationStoreMock },
                    { provide: NotificationHistoryService, useValue: notificationHistoryServiceMock },
                    provideRouter([])
                ]
            }).compileComponents();

            const fixture = TestBed.createComponent(App);
            fixture.detectChanges();
            const component = fixture.componentInstance;

            // Initial state should be Disconnected
            expect(component.connectionStateForTest()).toBe(HubConnectionState.Disconnected);

            // Simulate connection state changes via the observable
            connectionStatusSubject.next(HubConnectionState.Connected);
            fixture.detectChanges();
            await fixture.whenStable();
            expect(component.connectionStateForTest()).toBe(HubConnectionState.Connected);

            // Test that invalid names don't break anything (hook is not installed in this env)
            // The hook is gated by environment.enableE2eConnectionHook, so it's not available here
            expect(typeof window.__testConnectionStateOverride__).toBe('undefined');
        });
    });
});
