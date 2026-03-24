import { TestBed } from '@angular/core/testing';
import { PrivilegesStore } from './privileges.store';
import { PrivilegesService, RiskLevel } from './privileges.service';
import { of, throwError } from 'rxjs';
import { HttpErrorResponse, HttpHeaders } from '@angular/common/http';

describe('PrivilegesStore', () => {
  let store: PrivilegesStore;
  let serviceMock: any;

  const mockPrivilege = {
    id: '1',
    name: 'Test',
    riskLevel: RiskLevel.Low,
    isActive: true,
    rowVersion: '1'
  };

  beforeEach(() => {
    serviceMock = {
      getPrivileges: vi.fn(),
      getPrivilegeById: vi.fn(),
      updatePrivilege: vi.fn()
    };

    TestBed.configureTestingModule({
      providers: [
        PrivilegesStore,
        { provide: PrivilegesService, useValue: serviceMock }
      ]
    });

    store = TestBed.inject(PrivilegesStore);
  });

  it('should load privileges successfully', () => {
    serviceMock.getPrivileges.mockReturnValue(of({
      items: [mockPrivilege],
      totalCount: 1
    }));

    store.loadPrivileges(1, 10);

    expect(store.privileges()).toEqual([mockPrivilege]);
    expect(store.totalCount()).toBe(1);
    expect(store.status()).toBe('Success');
  });

  it('should pass licensed modules to the backend service', () => {
    serviceMock.getPrivileges.mockReturnValue(of({
      items: [mockPrivilege],
      totalCount: 1
    }));

    store.loadPrivileges();

    // The store should request privileges and pass its licensed modules to the backend
    expect(serviceMock.getPrivileges).toHaveBeenCalledWith(1, 10, undefined, ['Portal', 'LoanOrigination', 'Wires', 'System']);
  });

  it('should handle Step-Up requirement error', () => {
    const errorResponse = new HttpErrorResponse({
      status: 403,
      headers: new HttpHeaders().set('X-Step-Up-Required', 'true')
    });

    serviceMock.updatePrivilege.mockReturnValue(throwError(() => errorResponse));

    store.updatePrivilege('1', { isActive: false });

    expect(store.status()).toBe('StepUpRequired');
    expect(store.isStepUpRequired()).toBe(true);
  });

  it('should update selectedPrivilege after successful update', () => {
    const updatedPrivilege = { ...mockPrivilege, description: 'Updated' };
    serviceMock.updatePrivilege.mockReturnValue(of(updatedPrivilege));
    serviceMock.getPrivileges.mockReturnValue(of({ items: [], totalCount: 0 }));

    store.updatePrivilege('1', { description: 'Updated' });

    expect(store.selectedPrivilege()).toEqual(updatedPrivilege);
    expect(store.status()).toBe('Success');
  });
});
