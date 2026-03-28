import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ReactiveFormsModule } from '@angular/forms';
import { SecureInputComponent } from './secure-input';
import { By } from '@angular/platform-browser';

describe('SecureInputComponent', () => {
  let component: SecureInputComponent;
  let fixture: ComponentFixture<SecureInputComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [SecureInputComponent, ReactiveFormsModule],
    }).compileComponents();

    fixture = TestBed.createComponent(SecureInputComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should implement ControlValueAccessor correctly', () => {
    // Test writeValue
    const value = 'new value';
    component.writeValue(value);
    fixture.detectChanges();
    const input = fixture.debugElement.query(By.css('input'))
      .nativeElement as HTMLInputElement;
    expect(input.value).toBe(value);

    // Test registerOnChange
    let changedValue = '';
    component.registerOnChange((val: string) => {
      changedValue = val;
    });
    input.value = 'user input';
    input.dispatchEvent(new Event('input'));
    expect(changedValue).toBe('user input');
  });

  it('should apply autocomplete="new-password" for password type', () => {
    fixture.componentRef.setInput('type', 'password');
    fixture.detectChanges();
    const input = fixture.debugElement.query(By.css('input'))
      .nativeElement as HTMLInputElement;
    expect(input.getAttribute('autocomplete')).toBe('new-password');
  });

  it('should apply CSS-based masking for password fields', () => {
    fixture.componentRef.setInput('type', 'password');
    fixture.detectChanges();
    const input = fixture.debugElement.query(By.css('input'))
      .nativeElement as HTMLInputElement;
    // Check for the class name instead of computed style for stability.
    expect(input.classList.contains('secure-password-input')).toBe(true);
  });

  it('should render error message after touch', () => {
    fixture.componentRef.setInput('errorMessage', 'Invalid email');
    fixture.detectChanges();

    // Initially not visible
    expect(fixture.debugElement.query(By.css('.error-message'))).toBeNull();

    // Trigger blur
    const input = fixture.debugElement.query(By.css('input'))
      .nativeElement as HTMLInputElement;
    input.dispatchEvent(new Event('blur'));
    fixture.detectChanges();

    const errorEl = fixture.debugElement.query(By.css('.error-message'));
    expect(errorEl).toBeTruthy();
    expect(errorEl.nativeElement.textContent).toContain('Invalid email');
  });

  it('should handle disabled state', () => {
    component.setDisabledState(true);
    fixture.detectChanges();
    const input = fixture.debugElement.query(By.css('input'))
      .nativeElement as HTMLInputElement;
    expect(input.disabled).toBe(true);
  });

  it('should apply autocomplete="email" for email type', () => {
    fixture.componentRef.setInput('type', 'email');
    fixture.detectChanges();
    const input = fixture.debugElement.query(By.css('input'))
      .nativeElement as HTMLInputElement;
    expect(input.getAttribute('autocomplete')).toBe('email');
  });

  it('should apply autocomplete="off" for other types', () => {
    fixture.componentRef.setInput('type', 'text');
    fixture.detectChanges();
    const input = fixture.debugElement.query(By.css('input'))
      .nativeElement as HTMLInputElement;
    expect(input.getAttribute('autocomplete')).toBe('off');
  });

  it('should render placeholder', () => {
    fixture.componentRef.setInput('placeholder', 'Enter text');
    fixture.detectChanges();
    const input = fixture.debugElement.query(By.css('input'))
      .nativeElement as HTMLInputElement;
    expect(input.getAttribute('placeholder')).toBe('Enter text');
  });
});
