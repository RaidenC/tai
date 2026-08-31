import { TestBed } from '@angular/core/testing';
import { ToastService } from './toast.service';

describe('ToastService', () => {
  let service: ToastService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(ToastService);
  });

  it('should create', () => {
    expect(service).toBeTruthy();
  });

  describe('show()', () => {
    it('should set toast with message and info severity by default', () => {
      service.show('Test message');
      const toast = service.toast();

      expect(toast).toMatchObject({
        message: 'Test message',
        severity: 'info',
      });
    });

    it('should set toast with message and specified severity', () => {
      service.show('Warning message', 'warning');
      const toast = service.toast();

      expect(toast).toMatchObject({
        message: 'Warning message',
        severity: 'warning',
      });
    });

    it('should set toast with critical severity', () => {
      service.show('Critical error', 'critical');
      const toast = service.toast();

      expect(toast).toMatchObject({
        message: 'Critical error',
        severity: 'critical',
      });
    });

    it('should set timestamp when showing toast', () => {
      const before = Date.now();
      service.show('Test');
      const after = Date.now();
      const toast = service.toast();

      expect(toast).toMatchObject({ timestamp: expect.any(Number) });
      expect(toast?.timestamp).toBeGreaterThanOrEqual(before);
      expect(toast?.timestamp).toBeLessThanOrEqual(after);
    });

    it('should replace the current toast', () => {
      service.show('First message', 'info');
      service.show('Second message', 'warning');

      expect(service.toast()).toMatchObject({
        message: 'Second message',
        severity: 'warning',
      });
    });
  });

  describe('hide()', () => {
    it('should clear the toast', () => {
      service.show('Test message');
      expect(service.toast()).toBeTruthy();

      service.hide();

      expect(service.toast()).toBeNull();
    });
  });
});
