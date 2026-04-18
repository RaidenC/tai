import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ReactiveFormsModule } from '@angular/forms';
import { RouterTestingModule } from '@angular/router/testing';
import { provideMockStore, MockStore } from '@ngrx/store/testing';
import { BorrowerInfoComponent } from './borrower-info.component';
import { selectBorrower } from '../+state';

describe('BorrowerInfoComponent — SSN Re-Entry UX', () => {
  let fixture: ComponentFixture<BorrowerInfoComponent>;
  let store: MockStore;

  function createComponent(borrowerOverride: any) {
    TestBed.configureTestingModule({
      imports: [BorrowerInfoComponent, ReactiveFormsModule, RouterTestingModule],
      providers: [
        provideMockStore({
          selectors: [{ selector: selectBorrower, value: borrowerOverride }],
        }),
      ],
    });

    TestBed.compileComponents();
    store = TestBed.inject(MockStore);
    fixture = TestBed.createComponent(BorrowerInfoComponent);
    fixture.detectChanges();
  }

  it('shows SSN re-entry message when borrower hydrated without SSN', () => {
    createComponent({
      firstName: 'Jane',
      lastName: 'Doe',
      ssnLastFour: '',
      phone: '5551234567',
      email: 'jane@example.com',
    });
    const alert = fixture.nativeElement.querySelector('tai-security-alert');
    expect(alert).toBeTruthy();
  });

  it('does not show re-entry message on fresh form', () => {
    createComponent({
      firstName: '',
      lastName: '',
      ssnLastFour: '',
      phone: '',
      email: '',
    });
    const alert = fixture.nativeElement.querySelector('tai-security-alert');
    expect(alert).toBeNull();
  });

  it('does not show re-entry message when SSN is populated', () => {
    createComponent({
      firstName: 'Jane',
      lastName: 'Doe',
      ssnLastFour: '1234',
      phone: '5551234567',
      email: 'jane@example.com',
    });
    const alert = fixture.nativeElement.querySelector('tai-security-alert');
    expect(alert).toBeNull();
  });

  it('SSN field is empty after hydration', () => {
    createComponent({
      firstName: 'Jane',
      lastName: 'Doe',
      ssnLastFour: '',
      phone: '5551234567',
      email: 'jane@example.com',
    });
    const ssnInput = fixture.nativeElement.querySelector('#ssnLastFour') as HTMLInputElement;
    expect(ssnInput.value).toBe('');
  });
});
