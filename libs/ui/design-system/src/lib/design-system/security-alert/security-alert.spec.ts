import { ComponentFixture, TestBed } from '@angular/core/testing';
import { SecurityAlertComponent } from './security-alert';

describe('SecurityAlertComponent', () => {
  let fixture: ComponentFixture<SecurityAlertComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [SecurityAlertComponent],
    }).compileComponents();
  });

  it('renders message text', () => {
    fixture = TestBed.createComponent(SecurityAlertComponent);
    fixture.componentRef.setInput('message', 'Re-enter SSN');
    fixture.componentRef.setInput('visible', true);
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;
    expect(el.textContent).toContain('Re-enter SSN');
  });

  it('applies warning class by default', () => {
    fixture = TestBed.createComponent(SecurityAlertComponent);
    fixture.componentRef.setInput('message', 'Test');
    fixture.componentRef.setInput('visible', true);
    fixture.detectChanges();
    const alert = fixture.nativeElement.querySelector('[data-testid="security-alert"]');
    expect(alert.classList.contains('security-alert--warning')).toBe(true);
  });

  it('hidden when visible is false', () => {
    fixture = TestBed.createComponent(SecurityAlertComponent);
    fixture.componentRef.setInput('message', 'Hidden');
    fixture.componentRef.setInput('visible', false);
    fixture.detectChanges();
    const alert = fixture.nativeElement.querySelector('[data-testid="security-alert"]');
    expect(alert).toBeNull();
  });

  it('emits dismissed event on dismiss click', () => {
    fixture = TestBed.createComponent(SecurityAlertComponent);
    fixture.componentRef.setInput('message', 'Dismiss me');
    fixture.componentRef.setInput('visible', true);
    fixture.componentRef.setInput('dismissible', true);
    fixture.detectChanges();

    let dismissed = false;
    fixture.componentInstance.dismissed.subscribe(() => (dismissed = true));

    const btn = fixture.nativeElement.querySelector('[data-testid="security-alert-dismiss"]');
    btn.click();
    expect(dismissed).toBe(true);
  });

  it('has role="alert" and aria-live="polite" when visible', () => {
    fixture = TestBed.createComponent(SecurityAlertComponent);
    fixture.componentRef.setInput('message', 'Re-enter SSN');
    fixture.componentRef.setInput('visible', true);
    fixture.detectChanges();
    const alert = fixture.nativeElement.querySelector('[data-testid="security-alert"]');
    expect(alert.getAttribute('role')).toBe('alert');
    expect(alert.getAttribute('aria-live')).toBe('polite');
  });

  it('dismiss button has aria-label', () => {
    fixture = TestBed.createComponent(SecurityAlertComponent);
    fixture.componentRef.setInput('message', 'Dismiss me');
    fixture.componentRef.setInput('visible', true);
    fixture.componentRef.setInput('dismissible', true);
    fixture.detectChanges();
    const btn = fixture.nativeElement.querySelector('[data-testid="security-alert-dismiss"]');
    expect(btn.getAttribute('aria-label')).toBe('Dismiss alert');
  });
});
