import { ComponentFixture, TestBed } from '@angular/core/testing';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { NotificationToggleComponent } from './notification-toggle.component';
import { NotificationPanelService } from './notification-panel.service';

describe('NotificationToggleComponent', () => {
  let component: NotificationToggleComponent;
  let fixture: ComponentFixture<NotificationToggleComponent>;
  let panelService: NotificationPanelService;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [NotificationToggleComponent],
      providers: [NotificationPanelService],
    }).compileComponents();

    panelService = TestBed.inject(NotificationPanelService);
    fixture = TestBed.createComponent(NotificationToggleComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should show badge when unread > 0', () => {
    panelService.setUnreadCount(5);
    fixture.detectChanges();

    expect(component.showBadge).toBe(true);

    const badgeElement = fixture.nativeElement.querySelector('.unread-badge');
    expect(badgeElement).toBeTruthy();
    expect(badgeElement.textContent.trim()).toBe('5');
  });

  it('should hide badge when unread = 0', () => {
    panelService.setUnreadCount(0);
    fixture.detectChanges();

    expect(component.showBadge).toBe(false);

    const badgeElement = fixture.nativeElement.querySelector('.unread-badge');
    expect(badgeElement).toBeFalsy();
  });

  it('should show "9+" when unread > 9', () => {
    panelService.setUnreadCount(15);
    fixture.detectChanges();

    expect(component.showBadge).toBe(true);

    const badgeElement = fixture.nativeElement.querySelector('.unread-badge');
    expect(badgeElement).toBeTruthy();
    expect(badgeElement.textContent.trim()).toBe('9+');
  });

  it('should call toggle when button is clicked', () => {
    const toggleSpy = vi.spyOn(panelService, 'toggle');

    const button = fixture.nativeElement.querySelector('.toggle-button');
    button.click();

    expect(toggleSpy).toHaveBeenCalled();
  });
});