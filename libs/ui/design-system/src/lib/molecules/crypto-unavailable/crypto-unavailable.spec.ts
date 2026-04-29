import { ComponentFixture, TestBed } from '@angular/core/testing';
import { CryptoUnavailableComponent } from './crypto-unavailable';

describe('CryptoUnavailableComponent', () => {
  let fixture: ComponentFixture<CryptoUnavailableComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [CryptoUnavailableComponent],
    }).compileComponents();
  });

  it('renders default message', () => {
    fixture = TestBed.createComponent(CryptoUnavailableComponent);
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;
    expect(el.textContent).toContain('secure browser environment');
  });

  it('renders custom message', () => {
    fixture = TestBed.createComponent(CryptoUnavailableComponent);
    fixture.componentRef.setInput('message', 'Please use Chrome or Edge');
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;
    expect(el.textContent).toContain('Please use Chrome or Edge');
  });

  it('has role="alert" and aria-live="assertive"', () => {
    fixture = TestBed.createComponent(CryptoUnavailableComponent);
    fixture.detectChanges();
    const el = fixture.nativeElement.querySelector('[data-testid="crypto-unavailable"]');
    expect(el.getAttribute('role')).toBe('alert');
    expect(el.getAttribute('aria-live')).toBe('assertive');
  });
});
