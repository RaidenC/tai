import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ToastService } from './toast.service';
import { ToastComponent } from './toast.component';
import { signal } from '@angular/core';

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
      expect(toast).toBeTruthy();
      expect(toast!.message).toBe('Test message');
      expect(toast!.severity).toBe('info');
    });

    it('should set toast with message and specified severity', () => {
      service.show('Warning message', 'warning');
      const toast = service.toast();
      expect(toast).toBeTruthy();
      expect(toast!.message).toBe('Warning message');
      expect(toast!.severity).toBe('warning');
    });

    it('should set toast with critical severity', () => {
      service.show('Critical error', 'critical');
      const toast = service.toast();
      expect(toast).toBeTruthy();
      expect(toast!.message).toBe('Critical error');
      expect(toast!.severity).toBe('critical');
    });

    it('should set timestamp when showing toast', () => {
      const before = Date.now();
      service.show('Test');
      const after = Date.now();
      const toast = service.toast();
      expect(toast!.timestamp).toBeGreaterThanOrEqual(before);
      expect(toast!.timestamp).toBeLessThanOrEqual(after);
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

describe('ToastComponent', () => {
  let component: ToastComponent;
  let fixture: ComponentFixture<ToastComponent>;
  let toastService: ToastService;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ToastComponent],
      providers: [ToastService],
    }).compileComponents();

    fixture = TestBed.createComponent(ToastComponent);
    component = fixture.componentInstance;
    toastService = TestBed.inject(ToastService);
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should not render toast when none is set', () => {
    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('.toast')).toBeNull();
  });

  it('should render toast when toast is set', () => {
    toastService.show('Test message', 'info');
    fixture.detectChanges();
    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('.toast')).toBeTruthy();
    expect(compiled.querySelector('.toast-message')?.textContent).toContain('Test message');
  });

  it('should apply correct severity class for info', () => {
    toastService.show('Info message', 'info');
    fixture.detectChanges();
    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('.toast-info')).toBeTruthy();
  });

  it('should apply correct severity class for warning', () => {
    toastService.show('Warning message', 'warning');
    fixture.detectChanges();
    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('.toast-warning')).toBeTruthy();
  });

  it('should apply correct severity class for critical', () => {
    toastService.show('Critical message', 'critical');
    fixture.detectChanges();
    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('.toast-critical')).toBeTruthy();
  });

  describe('dismiss()', () => {
    it('should clear toast when dismiss is called', () => {
      toastService.show('Test message');
      fixture.detectChanges();
      expect(toastService.toast()).toBeTruthy();

      component.dismiss();
      fixture.detectChanges();
      expect(toastService.toast()).toBeNull();
    });

    it('should hide toast when close button is clicked', () => {
      toastService.show('Test message', 'info');
      fixture.detectChanges();

      const compiled = fixture.nativeElement as HTMLElement;
      const closeButton = compiled.querySelector('.toast-close') as HTMLButtonElement;
      closeButton.click();
      fixture.detectChanges();

      expect(toastService.toast()).toBeNull();
      expect(compiled.querySelector('.toast')).toBeNull();
    });
  });

  describe('getSeverityClass()', () => {
    it('should return empty string when no toast', () => {
      expect(component.getSeverityClass()).toBe('');
    });

    it('should return toast-info for info severity', () => {
      toastService.show('Test', 'info');
      expect(component.getSeverityClass()).toBe('toast-info');
    });

    it('should return toast-warning for warning severity', () => {
      toastService.show('Test', 'warning');
      expect(component.getSeverityClass()).toBe('toast-warning');
    });

    it('should return toast-critical for critical severity', () => {
      toastService.show('Test', 'critical');
      expect(component.getSeverityClass()).toBe('toast-critical');
    });
  });
});