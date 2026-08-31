import { beforeEach, describe, expect, it } from 'vitest';
import { NotificationPanelService } from './notification-panel.service';

describe('NotificationPanelService', () => {
  let service: NotificationPanelService;

  beforeEach(() => {
    service = new NotificationPanelService();
  });

  it('starts closed with default filters and no unread count', () => {
    expect(service.isOpen()).toBe(false);
    expect(service.severityFilter()).toBe('all');
    expect(service.searchText()).toBe('');
    expect(service.unreadCount()).toBe(0);
  });

  it('opens, closes, and toggles the panel', () => {
    service.open();
    expect(service.isOpen()).toBe(true);

    service.close();
    expect(service.isOpen()).toBe(false);

    service.toggle();
    expect(service.isOpen()).toBe(true);

    service.toggle();
    expect(service.isOpen()).toBe(false);
  });

  it('stores severity and search state', () => {
    service.setSeverityFilter('warning');
    service.setSearchText('rate limit');

    expect(service.severityFilter()).toBe('warning');
    expect(service.searchText()).toBe('rate limit');
  });

  it('preserves deprecated unread-count compatibility behavior', () => {
    service.setUnreadCount(4);
    expect(service.unreadCount()).toBe(0);

    service.decrementUnread();
    expect(service.unreadCount()).toBe(0);

    service.markAllAsRead();
    expect(service.unreadCount()).toBe(0);
  });
});
