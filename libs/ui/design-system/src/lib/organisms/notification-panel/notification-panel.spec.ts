import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NotificationPanelComponent } from './notification-panel.component';
import { NotificationPanelService } from './notification-panel.service';
import { NotificationPanelItem } from './notification-panel.types';
import { isSignal } from '@angular/core';

describe('NotificationPanelComponent', () => {
  let component: NotificationPanelComponent;
  let fixture: ComponentFixture<NotificationPanelComponent>;
  let panelService: NotificationPanelService;

  const mockNotifications: NotificationPanelItem[] = [
    {
      id: '1',
      title: 'Login Anomaly Detected',
      summary: 'Suspicious login detected',
      severity: 'critical',
      category: 'authentication',
      actor: 'user-1',
      timestamp: new Date().toISOString(),
      userId: 'user-1'
    },
    {
      id: '2',
      title: 'Rate Limit Warning',
      summary: 'Rate limit warning',
      severity: 'warning',
      category: 'security',
      actor: 'user-2',
      timestamp: new Date(Date.now() - 60000).toISOString(),
      userId: 'user-2'
    },
    {
      id: '3',
      title: 'User Logged In',
      summary: 'User logged in',
      severity: 'info',
      category: 'authentication',
      actor: 'user-3',
      timestamp: new Date(Date.now() - 3600000).toISOString(),
      userId: 'user-3'
    },
    {
      id: '4',
      title: 'Privilege Modified',
      summary: 'Privilege was modified',
      severity: 'critical',
      category: 'privilege',
      actor: 'user-4',
      timestamp: new Date(Date.now() - 120000).toISOString(),
      userId: 'user-4'
    }
  ];

  beforeEach(async () => {
    panelService = new NotificationPanelService();

    await TestBed.configureTestingModule({
      imports: [NotificationPanelComponent],
      providers: [
        { provide: NotificationPanelService, useValue: panelService }
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(NotificationPanelComponent);
    component = fixture.componentInstance;
    component.notifications = mockNotifications;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  describe('Panel visibility', () => {
    it('should NOT show panel when isOpen is false', () => {
      panelService.close();
      fixture.detectChanges();

      const overlay = fixture.nativeElement.querySelector('.panel-overlay');
      const panel = fixture.nativeElement.querySelector('.notification-panel');

      expect(overlay).toBeNull();
      expect(panel).toBeNull();
    });

    it('should show panel when isOpen is true', () => {
      panelService.open();
      fixture.detectChanges();

      const overlay = fixture.nativeElement.querySelector('.panel-overlay');
      const panel = fixture.nativeElement.querySelector('.notification-panel');

      expect(overlay).toBeTruthy();
      expect(panel).toBeTruthy();
    });
  });

  describe('Severity filter buttons', () => {
    beforeEach(() => {
      component.notifications = mockNotifications;
      panelService.open();
      fixture.detectChanges();
    });

    it('should have filter buttons', () => {
      const buttons = fixture.nativeElement.querySelectorAll('.filter-buttons button');
      expect(buttons.length).toBe(4);
    });

    it('should filter by critical', () => {
      component.setSeverity('critical');
      fixture.detectChanges();

      const eventItems = fixture.nativeElement.querySelectorAll('.event-item');
      expect(eventItems.length).toBe(2);
    });

    it('should filter by warning', () => {
      component.setSeverity('warning');
      fixture.detectChanges();

      const eventItems = fixture.nativeElement.querySelectorAll('.event-item');
      expect(eventItems.length).toBe(1);
    });

    it('should show all when filter is all', () => {
      component.setSeverity('all');
      fixture.detectChanges();

      const eventItems = fixture.nativeElement.querySelectorAll('.event-item');
      expect(eventItems.length).toBe(4);
    });

    it('should show info for non-critical/warning events', () => {
      component.setSeverity('info');
      fixture.detectChanges();

      const eventItems = fixture.nativeElement.querySelectorAll('.event-item');
      // UserLoggedIn is info level
      expect(eventItems.length).toBe(1);
    });
  });

  describe('Search functionality', () => {
    beforeEach(() => {
      component.notifications = mockNotifications;
      panelService.setSeverityFilter('all'); // Reset severity filter
      panelService.setSearchText(''); // Reset search text
      panelService.open();
      fixture.detectChanges();
    });

    it('should have search input', () => {
      const searchInput = fixture.nativeElement.querySelector('.search-box input');
      expect(searchInput).toBeTruthy();
    });

    it('should filter events by search text', () => {
      // Directly set search text via service to ensure it's applied
      panelService.setSearchText('login');
      fixture.detectChanges();

      const eventItems = fixture.nativeElement.querySelectorAll('.event-item');
      // Should match "Login Anomaly Detected" (id: '1')
      // "User Logged In" has severity info, but with severity='all' both should match
      expect(eventItems.length).toBeGreaterThanOrEqual(1);
    });

    it('should filter by details search', () => {
      const searchInput = fixture.nativeElement.querySelector('.search-box input');
      searchInput.value = 'suspicious';
      searchInput.dispatchEvent(new Event('input'));
      fixture.detectChanges();

      const eventItems = fixture.nativeElement.querySelectorAll('.event-item');
      expect(eventItems.length).toBe(1);
    });

    it('should show all when search is empty', () => {
      // First add a search term
      const searchInput = fixture.nativeElement.querySelector('.search-box input');
      searchInput.value = 'login';
      searchInput.dispatchEvent(new Event('input'));
      fixture.detectChanges();

      // Then clear it
      searchInput.value = '';
      searchInput.dispatchEvent(new Event('input'));
      fixture.detectChanges();

      const eventItems = fixture.nativeElement.querySelectorAll('.event-item');
      expect(eventItems.length).toBe(4);
    });
  });

  describe('Empty state', () => {
    it('should show empty state when no events', () => {
      component.notifications = [];
      panelService.open();
      fixture.detectChanges();

      const emptyState = fixture.nativeElement.querySelector('.empty-state');
      expect(emptyState).toBeTruthy();
      expect(emptyState.textContent).toContain('No recent notifications');
    });

    it('should not show empty state when events exist', () => {
      component.notifications = mockNotifications;
      panelService.open();
      fixture.detectChanges();

      const emptyState = fixture.nativeElement.querySelector('.empty-state');
      expect(emptyState).toBeFalsy();
    });
  });

  describe('Close panel', () => {
    it('should close panel when close button clicked', () => {
      panelService.open();
      fixture.detectChanges();

      const closeBtn = fixture.nativeElement.querySelector('.close-btn');
      closeBtn.click();
      fixture.detectChanges();

      const panel = fixture.nativeElement.querySelector('.notification-panel');
      expect(panel).toBeNull();
    });

    it('should close panel when overlay clicked', () => {
      panelService.open();
      fixture.detectChanges();

      const overlay = fixture.nativeElement.querySelector('.panel-overlay');
      overlay.click();
      fixture.detectChanges();

      const panel = fixture.nativeElement.querySelector('.notification-panel');
      expect(panel).toBeNull();
    });
  });

  describe('Signal properties', () => {
    it('should have isOpen as computed signal', () => {
      expect(component.isOpen).toBeDefined();
      expect(isSignal(component.isOpen)).toBe(true);
    });

    it('should have severityFilter as computed signal', () => {
      expect(component.severityFilter).toBeDefined();
      expect(isSignal(component.severityFilter)).toBe(true);
    });

    it('should have searchText as computed signal', () => {
      expect(component.searchText).toBeDefined();
      expect(isSignal(component.searchText)).toBe(true);
    });
  });

  describe('Loading state', () => {
    it('renders loading state with polite status live region while keeping notifications visible', () => {
      component.isLoading = true;
      component.notifications = mockNotifications;
      panelService.open();
      fixture.detectChanges();

      const status = fixture.nativeElement.querySelector('[role="status"][aria-live="polite"]');
      expect(status?.textContent).toContain('Loading recent notifications');
      expect(fixture.nativeElement.textContent).toContain('Login Anomaly Detected');
    });
  });

  describe('Empty state', () => {
    it('renders empty state with polite status live region', () => {
      component.isLoading = false;
      component.error = null;
      component.notifications = [];
      panelService.open();
      fixture.detectChanges();

      const status = fixture.nativeElement.querySelector('[role="status"][aria-live="polite"]');
      expect(status?.textContent).toContain('No recent notifications');
    });
  });

  describe('Error state', () => {
    it('renders error state with assertive alert and retry button', () => {
      const retrySpy = vi.spyOn(component.retry, 'emit');
      component.error = 'Unable to load recent notifications';
      panelService.open();
      fixture.detectChanges();

      const alert = fixture.nativeElement.querySelector('[role="alert"][aria-live="assertive"]');
      const button = fixture.nativeElement.querySelector('button[type="button"].retry-btn');

      expect(alert?.textContent).toContain('Unable to load recent notifications');
      button.click();
      expect(retrySpy).toHaveBeenCalled();
    });

    it('disables retry while loading or throttled', () => {
      component.error = 'Retry limit reached. Try again shortly.';
      component.isLoading = true;
      panelService.open();
      fixture.detectChanges();

      const button = fixture.nativeElement.querySelector('button[type="button"].retry-btn') as HTMLButtonElement;
      expect(button.disabled).toBe(true);
    });
  });

  describe('Helper methods', () => {
    it('should get severity class for critical', () => {
      expect(component.getSeverityClass('critical')).toBe('severity-critical');
    });

    it('should get severity class for warning', () => {
      expect(component.getSeverityClass('warning')).toBe('severity-warning');
    });

    it('should get severity class for info', () => {
      expect(component.getSeverityClass('info')).toBe('severity-info');
    });

    it('should get event severity for string input', () => {
      expect(component.getEventSeverity('LoginAnomaly')).toBe('critical');
    });

    it('should get event severity for warning string', () => {
      expect(component.getEventSeverity('WarningRateLimit')).toBe('warning');
    });

    it('should get event severity for info string', () => {
      expect(component.getEventSeverity('UserLogin')).toBe('info');
    });

    it('should get severity from NotificationPanelItem', () => {
      expect(component.getEventSeverity({
        id: '4',
        title: 'Privilege Modified',
        summary: 'Privilege was modified',
        severity: 'critical',
        category: 'privilege',
        actor: 'user-4',
        timestamp: new Date().toISOString(),
        userId: 'user-4'
      })).toBe('critical');
    });

    it('should format time as Just now', () => {
      const now = new Date().toISOString();
      expect(component.formatTime(now)).toBe('Just now');
    });

    it('should format time as minutes ago', () => {
      const fiveMinsAgo = new Date(Date.now() - 5 * 60000).toISOString();
      expect(component.formatTime(fiveMinsAgo)).toBe('5 min ago');
    });

    it('should format time as hours ago', () => {
      const twoHoursAgo = new Date(Date.now() - 2 * 3600000).toISOString();
      expect(component.formatTime(twoHoursAgo)).toBe('2 hr ago');
    });
  });
});
