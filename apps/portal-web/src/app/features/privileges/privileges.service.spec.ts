import { TestBed } from '@angular/core/testing';
import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';
import { PrivilegesService, RiskLevel, Privilege } from './privileges.service';

describe('PrivilegesService', () => {
  let service: PrivilegesService;
  let httpMock: HttpTestingController;

  const mockPrivilege: Privilege = {
    id: '1',
    name: 'Test.Privilege',
    description: 'Test description',
    module: 'TestModule',
    riskLevel: RiskLevel.Medium,
    isActive: true,
    rowVersion: 'AAAA',
    jitSettings: { maxElevationDuration: null, requiresApproval: false, requiresJustification: false }
  };

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule],
      providers: [PrivilegesService]
    });
    service = TestBed.inject(PrivilegesService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('should fetch privileges with pagination', () => {
    const mockResponse = {
      items: [mockPrivilege],
      totalCount: 1,
      pageNumber: 1,
      totalPages: 1,
      hasNextPage: false,
      hasPreviousPage: false
    };

    service.getPrivileges(1, 10).subscribe(data => {
      expect(data.items.length).toBe(1);
      expect(data.items[0].name).toBe('Test.Privilege');
    });

    const req = httpMock.expectOne('/api/privileges?pageNumber=1&pageSize=10');
    expect(req.request.method).toBe('GET');
    req.flush(mockResponse);
  });

  it('should update privilege with step-up header', () => {
    service.updatePrivilege('1', { isActive: false }, true).subscribe();

    const req = httpMock.expectOne('/api/privileges/1');
    expect(req.request.method).toBe('PUT');
    expect(req.request.headers.get('X-Step-Up-Verified')).toBe('true');
    req.flush(mockPrivilege);
  });
});
