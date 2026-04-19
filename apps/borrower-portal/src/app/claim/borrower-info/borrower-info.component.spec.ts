import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ReactiveFormsModule } from '@angular/forms';
import { RouterTestingModule } from '@angular/router/testing';
import { provideMockStore, MockStore } from '@ngrx/store/testing';
import { BorrowerInfoComponent } from './borrower-info.component';
import { selectBorrower } from '../+state';

describe('BorrowerInfoComponent — SSN Re-Entry UX', () => {
  let fixture: ComponentFixture<BorrowerInfoComponent>;
  let store: MockStore;

  async function createComponent(borrowerOverride: any) {
    await TestBed.configureTestingModule({
      imports: [BorrowerInfoComponent, ReactiveFormsModule, RouterTestingModule],
      providers: [
        provideMockStore({
          selectors: [{ selector: selectBorrower, value: borrowerOverride }],
        }),
      ],
    }).compileComponents();

    store = TestBed.inject(MockStore);
    fixture = TestBed.createComponent(BorrowerInfoComponent);
    fixture.detectChanges();
  }

  it('does not overwrite user-typed firstName when store emits a new borrower value', async () => {
    createComponent({
      firstName: 'Jane',
      lastName: 'Doe',
      ssnLastFour: '',
      phone: '5551234567',
      email: 'jane@example.com',
    });

    // User starts editing
    fixture.componentInstance.form.patchValue({ firstName: 'Janet' });

    // Store emits a new borrower slice (e.g. an auto-save round-trip)
    store.overrideSelector(selectBorrower, {
      firstName: 'Jane',
      lastName: 'Doe',
      ssnLastFour: '',
      phone: '5551234567',
      email: 'jane@example.com',
    });
    store.refreshState();
    fixture.detectChanges();

    expect(fixture.componentInstance.form.get('firstName')?.value).toBe('Janet');
  });

  it('shows SSN re-entry message when borrower hydrated without SSN', async () => {
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

  it('does not show re-entry message on fresh form', async () => {
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

  it('does not show re-entry message when SSN is populated', async () => {
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

  it('SSN field is empty after hydration', async () => {
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
