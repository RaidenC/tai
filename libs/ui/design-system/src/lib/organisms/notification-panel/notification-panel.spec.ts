import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NotificationPanelComponent } from './notification-panel.component';
import { NotificationPanelService } from './notification-panel.service';
import { AuditLogDetails } from './notification-panel.types';
import { isSignal } from '@angular/core';

describe('NotificationPanelComponent', () => {
  let component: NotificationPanelComponent;
  let fixture: ComponentFixture<NotificationPanelComponent>;
  let panelService: NotificationPanelService;

  const mockEvents: AuditLogDetails[] = [
    {
      id: '1',
      tenantId: 'tenant-1',
      userId: 'user-1',
      action: 'LoginAnomaly',
      resourceId: 'resource-1',
      correlationId: 'corr-1',
      timestamp: new Date().toISOString(),
      ipAddress: '192.168.1.1',
      details: 'Suspicious login detected'
    },
    {
      id: '2',
      tenantId: 'tenant-1',
      userId: 'user-2',
      action: 'WarningRateLimit',
      resourceId: 'resource-2',
      correlationId: 'corr-2',
      timestamp: new Date(Date.now() - 60000).toISOString(),
      ipAddress: '10.0.0.1',
      details: 'Rate limit warning'
    },
    {
      id: '3',
      tenantId: 'tenant-1',
      userId: 'user-3',
      action: 'UserLogin',
      resourceId: 'resource-3',
      correlationId: null,
      timestamp: new Date(Date.now() - 3600000).toISOString(),
      ipAddress: null,
      details: 'User logged in'
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
    component.events = mockEvents;
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
      component.events = mockEvents;
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
      expect(eventItems.length).toBe(1);
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
      expect(eventItems.length).toBe(3);
    });

    it('should show info for non-critical/warning events', () => {
      component.setSeverity('info');
      fixture.detectChanges();

      const eventItems = fixture.nativeElement.querySelectorAll('.event-item');
      // UserLogin is info level
      expect(eventItems.length).toBe(1);
    });
  });

  describe('Search functionality', () => {
    beforeEach(() => {
      component.events = mockEvents;
      panelService.open();
      fixture.detectChanges();
    });

    it('should have search input', () => {
      const searchInput = fixture.nativeElement.querySelector('.search-box input');
      expect(searchInput).toBeTruthy();
    });

    it('should filter events by search text', () => {
      const searchInput = fixture.nativeElement.querySelector('.search-box input');
      searchInput.value = 'login';
      searchInput.dispatchEvent(new Event('input'));
      fixture.detectChanges();

      const eventItems = fixture.nativeElement.querySelectorAll('.event-item');
      // Should match LoginAnomaly and UserLogin
      expect(eventItems.length).toBe(2);
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
      expect(eventItems.length).toBe(3);
    });
  });

  describe('Empty state', () => {
    it('should show empty state when no events', () => {
      component.events = [];
      panelService.open();
      fixture.detectChanges();

      const emptyState = fixture.nativeElement.querySelector('.empty-state');
      expect(emptyState).toBeTruthy();
      expect(emptyState.textContent).toContain('No notifications');
    });

    it('should not show empty state when events exist', () => {
      component.events = mockEvents;
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

    it('should get event severity for anomaly', () => {
      expect(component.getEventSeverity('LoginAnomaly')).toBe('critical');
    });

    it('should get event severity for warning', () => {
      expect(component.getEventSeverity('WarningRateLimit')).toBe('warning');
    });

    it('should get event severity for info', () => {
      expect(component.getEventSeverity('UserLogin')).toBe('info');
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