import { TestBed } from '@angular/core/testing';
import { isSignal } from '@angular/core';
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
    expect(isSignal(service.isOpen)).toBe(true);
  });

  it('should have unreadCount as signal', () => {
    expect(service.unreadCount).toBeDefined();
    expect(isSignal(service.unreadCount)).toBe(true);
  });

  it('should have severityFilter as signal', () => {
    expect(service.severityFilter).toBeDefined();
    expect(isSignal(service.severityFilter)).toBe(true);
  });

  it('should have searchText as signal', () => {
    expect(service.searchText).toBeDefined();
    expect(isSignal(service.searchText)).toBe(true);
  });

  it('should toggle panel visibility', () => {
    service.toggle();
    expect(service.isOpen()()).toBe(true);
    service.toggle();
    expect(service.isOpen()()).toBe(false);
  });

  it('should open panel', () => {
    service.open();
    expect(service.isOpen()()).toBe(true);
  });

  it('should close panel', () => {
    service.open();
    service.close();
    expect(service.isOpen()()).toBe(false);
  });

  it('should set unread count', () => {
    service.setUnreadCount(5);
    expect(service.unreadCount()()).toBe(5);
  });

  it('should decrement unread count', () => {
    service.setUnreadCount(5);
    service.decrementUnread();
    expect(service.unreadCount()()).toBe(4);
  });

  it('should not decrement below zero', () => {
    service.setUnreadCount(0);
    service.decrementUnread();
    expect(service.unreadCount()()).toBe(0);
  });

  it('should set search text', () => {
    service.setSearchText('test query');
    expect(service.searchText()()).toBe('test query');
  });

  it('should clear unread count', () => {
    service.markAllAsRead();
    expect(service.unreadCount()()).toBe(0);
  });

  it('should filter by severity', () => {
    service.setSeverityFilter('critical');
    expect(service.severityFilter()()).toBe('critical');
  });

  it('should auto-mark as read when opening panel', () => {
    service.setUnreadCount(5);
    service.open();
    expect(service.unreadCount()()).toBe(0);
  });

  it('should auto-mark as read when toggling panel open', () => {
    service.setUnreadCount(3);
    service.toggle();
    expect(service.unreadCount()()).toBe(0);
  });
});