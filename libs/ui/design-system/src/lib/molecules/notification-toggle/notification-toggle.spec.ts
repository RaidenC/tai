import { ComponentFixture, TestBed } from '@angular/core/testing';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { NotificationToggleComponent } from './notification-toggle.component';

describe('NotificationToggleComponent', () => {
  let component: NotificationToggleComponent;
  let fixture: ComponentFixture<NotificationToggleComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [NotificationToggleComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(NotificationToggleComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('shows badge from unreadCount input', () => {
    fixture.componentRef.setInput('unreadCount', 5);
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('.unread-badge')?.textContent.trim()).toBe('5');
  });

  it('hides badge when unreadCount input is zero', () => {
    fixture.componentRef.setInput('unreadCount', 0);
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('.unread-badge')).toBeNull();
  });

  it('shows 9+ when unreadCount input is greater than 9', () => {
    fixture.componentRef.setInput('unreadCount', 15);
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('.unread-badge')?.textContent.trim()).toBe('9+');
  });

  it('emits toggled when button is clicked', () => {
    const spy = vi.spyOn(component.toggled, 'emit');

    fixture.nativeElement.querySelector('.toggle-button').click();

    expect(spy).toHaveBeenCalled();
  });

  it('sets aria-expanded and aria-controls', () => {
    fixture.componentRef.setInput('isOpen', true);
    fixture.detectChanges();
    const button = fixture.nativeElement.querySelector('button');
    expect(button.getAttribute('aria-expanded')).toBe('true');
    expect(button.getAttribute('aria-controls')).toBe('notification-panel');
  });

  it('shows reconnecting status in accessible label', () => {
    fixture.componentRef.setInput('connectionState', 'reconnecting');
    fixture.detectChanges();
    const button = fixture.nativeElement.querySelector('button');
    expect(button.getAttribute('aria-label')).toBe('Toggle notifications, updates reconnecting');
  });

  it('shows disconnected status in accessible label', () => {
    fixture.componentRef.setInput('connectionState', 'disconnected');
    fixture.detectChanges();
    const button = fixture.nativeElement.querySelector('button');
    expect(button.getAttribute('aria-label')).toBe('Toggle notifications, updates offline');
  });

  it('hides connection indicator when connected', () => {
    fixture.componentRef.setInput('connectionState', 'connected');
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.connection-indicator')).toBeNull();
  });

  it('shows connection indicator when disconnected', () => {
    fixture.componentRef.setInput('connectionState', 'disconnected');
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.connection-indicator')).toBeTruthy();
  });
});