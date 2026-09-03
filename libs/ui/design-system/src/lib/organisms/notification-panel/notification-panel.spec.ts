import { ComponentFixture, TestBed } from '@angular/core/testing';
import { vi } from 'vitest';
import { NotificationPanelComponent } from './notification-panel.component';
import { NotificationPanelService } from './notification-panel.service';

describe('NotificationPanelComponent', () => {
  let component: NotificationPanelComponent;
  let fixture: ComponentFixture<NotificationPanelComponent>;
  let panelService: NotificationPanelService;

  beforeEach(async () => {
    panelService = new NotificationPanelService();

    await TestBed.configureTestingModule({
      imports: [NotificationPanelComponent],
      providers: [
        { provide: NotificationPanelService, useValue: panelService },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(NotificationPanelComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  describe('getSeverityClass', () => {
    it.each([
      ['critical', 'bg-red-600'],
      ['warning', 'bg-amber-500'],
      ['info', 'bg-blue-500'],
      ['unknown', 'bg-blue-500'],
    ])('maps %s severity to %s', (severity, expectedClass) => {
      expect(component.getSeverityClass(severity)).toBe(expectedClass);
    });
  });

  describe('formatTime', () => {
    afterEach(() => {
      vi.useRealTimers();
    });

    it.each([
      ['', 'Unknown'],
      ['not-a-timestamp', 'Unknown'],
    ])('returns %s for an invalid timestamp', (timestamp, expected) => {
      expect(component.formatTime(timestamp)).toBe(expected);
    });

    it('formats recent timestamps using relative labels and older timestamps as dates', () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date('2026-08-31T12:00:00.000Z'));

      expect(component.formatTime('2026-08-31T11:59:30.000Z')).toBe('Just now');
      expect(component.formatTime('2026-08-31T11:55:00.000Z')).toBe(
        '5 min ago',
      );
      expect(component.formatTime('2026-08-31T10:00:00.000Z')).toBe('2 hr ago');
      expect(component.formatTime('2026-08-29T12:00:00.000Z')).toBe(
        new Date('2026-08-29T12:00:00.000Z').toLocaleDateString(),
      );
    });
  });

  describe('initial skeleton timing', () => {
    it('delays the initial skeleton and keeps it visible for at least 300ms', async () => {
      vi.useFakeTimers();

      try {
        panelService.open();
        fixture.componentRef.setInput('isLoading', true);
        fixture.componentRef.setInput('hasHydrated', false);
        fixture.detectChanges();

        expect(
          fixture.nativeElement.querySelectorAll('.skeleton-item'),
        ).toHaveLength(0);

        await vi.advanceTimersByTimeAsync(300);
        fixture.detectChanges();
        expect(
          fixture.nativeElement.querySelectorAll('.skeleton-item'),
        ).toHaveLength(3);

        fixture.componentRef.setInput('isLoading', false);
        fixture.detectChanges();

        await vi.advanceTimersByTimeAsync(299);
        fixture.detectChanges();
        expect(
          fixture.nativeElement.querySelectorAll('.skeleton-item'),
        ).toHaveLength(3);

        await vi.advanceTimersByTimeAsync(1);
        fixture.detectChanges();
        expect(
          fixture.nativeElement.querySelectorAll('.skeleton-item'),
        ).toHaveLength(0);
      } finally {
        vi.useRealTimers();
      }
    });
  });
});
