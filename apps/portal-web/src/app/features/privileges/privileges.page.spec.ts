import { ComponentFixture, TestBed } from '@angular/core/testing';
import { PrivilegesPage } from './privileges.page';
import { PrivilegesStore } from './privileges.store';
import { RouterTestingModule } from '@angular/router/testing';
import { DialogModule } from '@angular/cdk/dialog';
import { signal } from '@angular/core';

describe('PrivilegesPage', () => {
  let component: PrivilegesPage;
  let fixture: ComponentFixture<PrivilegesPage>;
  let storeMock: any;

  beforeEach(async () => {
    storeMock = {
      privileges: signal([]),
      totalCount: signal(0),
      pageIndex: signal(1),
      pageSize: signal(10),
      isLoading: signal(false),
      isError: signal(false),
      isStepUpRequired: signal(false),
      errorMessage: signal(null),
      loadPrivileges: vi.fn(),
      updatePrivilege: vi.fn()
    };

    await TestBed.configureTestingModule({
      imports: [PrivilegesPage, RouterTestingModule, DialogModule],
      providers: [
        { provide: PrivilegesStore, useValue: storeMock }
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(PrivilegesPage);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should render title', () => {
    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('h1')?.textContent).toContain('Privilege Catalog');
  });

  it('should show step-up alert when required', () => {
    storeMock.isStepUpRequired.set(true);
    fixture.detectChanges();
    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.textContent).toContain('Step-up authentication required');
  });
});
