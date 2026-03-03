import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Login } from './login';
import { provideRouter } from '@angular/router';

describe('Login', () => {
  let component: Login;
  let fixture: ComponentFixture<Login>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Login],
      providers: [provideRouter([])]
    }).compileComponents();

    fixture = TestBed.createComponent(Login);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should compute error message for invalid_credentials', () => {
    fixture.componentRef.setInput('error', 'invalid_credentials');
    fixture.detectChanges();
    // We use @ts-expect-error or access protected via any for testing if needed, 
    // but better check if it's rendered in template or use a public getter if available.
    // In this case, we check the template.
    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.textContent).toContain('Invalid login attempt');
  });

  it('should compute error message for tenant_not_found', () => {
    fixture.componentRef.setInput('error', 'tenant_not_found');
    fixture.detectChanges();
    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.textContent).toContain('institution you are trying to access could not be identified');
  });

  it('should compute empty error message for unknown error', () => {
    fixture.componentRef.setInput('error', 'unknown');
    fixture.detectChanges();
    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('.error-message-box')).toBeNull();
  });

  it('should handle login submission', async () => {
    vi.useFakeTimers();
    const mockData = { email: 'test@test.com', password: 'password' };
    
    // Mock form.submit and elements.namedItem
    const mockForm = {
      submit: vi.fn(),
      elements: {
        namedItem: vi.fn().mockReturnValue({ value: '' })
      }
    };
    // @ts-expect-error - mocking viewChild return
    vi.spyOn(component, 'hiddenForm').mockReturnValue({ nativeElement: mockForm });

    component.onLoginSubmitted(mockData);
    
    vi.runAllTimers();
    expect(mockForm.submit).toHaveBeenCalled();
    vi.useRealTimers();
  });

  it('should not throw if form is missing during submission', async () => {
    vi.useFakeTimers();
    const mockData = { email: 'test@test.com', password: 'password' };
    
    // @ts-expect-error - mocking viewChild return null
    vi.spyOn(component, 'hiddenForm').mockReturnValue(null);

    component.onLoginSubmitted(mockData);
    
    vi.runAllTimers();
    // Should not crash
    vi.useRealTimers();
  });

  it('should generate correct apiLoginUrl', () => {
    // @ts-expect-error - access protected
    const url = component.apiLoginUrl;
    expect(url).toContain(':5217/identity/Account/Login');
  });
});
