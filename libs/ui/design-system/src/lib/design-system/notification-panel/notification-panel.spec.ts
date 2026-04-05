import { TestBed } from '@angular/core/testing';
import { NotificationPanelService } from './notification-panel.service';

describe('NotificationPanelService', () => {
  let service: NotificationPanelService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(NotificationPanelService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('should have isOpen as signal', () => {
    expect(service.isOpen).toBeDefined();
    expect(typeof service.isOpen === 'function').toBe(true);
  });

  it('should have unreadCount as signal', () => {
    expect(service.unreadCount).toBeDefined();
    expect(typeof service.unreadCount === 'function').toBe(true);
  });

  it('should toggle panel visibility', () => {
    service.toggle();
    expect(service.isOpen()()).toBe(true);
    service.toggle();
    expect(service.isOpen()()).toBe(false);
  });

  it('should clear unread count', () => {
    service.markAllAsRead();
    expect(service.unreadCount()()).toBe(0);
  });

  it('should filter by severity', () => {
    service.setSeverityFilter('critical');
    expect(service.severityFilter()()).toBe('critical');
  });
});