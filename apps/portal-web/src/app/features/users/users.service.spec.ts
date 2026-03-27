import { TestBed } from '@angular/core/testing';
import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';
import { UsersService, User, PaginatedUsers, UserDetail } from './users.service';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';

describe('UsersService', () => {
  let service: UsersService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule],
      providers: [UsersService]
    });
    service = TestBed.inject(UsersService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('should fetch paginated users', () => {
    const mockResponse: PaginatedUsers = {
      items: [{ id: '1', firstName: 'John', lastName: 'Doe', email: 'john@tai.com', status: 'Active', rowVersion: 1 }],
      totalCount: 1,
      pageNumber: 1,
      pageSize: 10
    };

    service.getUsers(1, 10).subscribe(response => {
      expect(response).toEqual(mockResponse);
    });

    const req = httpMock.expectOne('/api/users?pageNumber=1&pageSize=10');
    expect(req.request.method).toBe('GET');
    req.flush(mockResponse);
  });

  it('should fetch user by ID', () => {
    const mockUser: UserDetail = { id: '1', firstName: 'John', lastName: 'Doe', email: 'john@tai.com', status: 'Active', rowVersion: 1, institution: 'Tai', privilegeIds: [] };

    service.getUserById('1').subscribe(user => {
      expect(user).toEqual(mockUser);
    });

    const req = httpMock.expectOne('/api/users/1');
    expect(req.request.method).toBe('GET');
    req.flush(mockUser);
  });

  it('should update user with If-Match header', () => {
    const updateData: Partial<User> = { firstName: 'Johnny' };
    service.updateUser('user-123', updateData, 456).subscribe();

    const req = httpMock.expectOne('/api/users/user-123');
    expect(req.request.method).toBe('PUT');
    expect(req.request.headers.get('If-Match')).toBe('"456"');
    expect(req.request.body).toEqual(updateData);
    req.flush(null);
  });

  it('should approve user with If-Match header', () => {
    service.approveUser('user-123', 456).subscribe();

    const req = httpMock.expectOne('/api/users/user-123/approve');
    expect(req.request.method).toBe('POST');
    expect(req.request.headers.get('If-Match')).toBe('"456"');
    req.flush(null);
  });
});
