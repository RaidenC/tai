import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable } from 'rxjs';

/**
 * User Interface for the Directory List.
 */
export interface User {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  status: string;
  rowVersion: number;
}

/**
 * User Details including institution.
 */
export interface UserDetail extends User {
  institution?: string;
}

/**
 * Paginated Response for Users.
 */
export interface PaginatedUsers {
  items: User[];
  totalCount: number;
  pageNumber: number;
  pageSize: number;
}

/**
 * UsersService
 * 
 * Persona: Backend Integration Architect.
 * Context: Secure communication with the Users API.
 * 
 * Features:
 * 1. Typed interfaces for user management.
 * 2. Concurrency handling via If-Match (ETag) headers.
 * 3. Automatic DPoP signing (via dpopInterceptor).
 */
@Injectable({
  providedIn: 'root',
})
export class UsersService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = '/api/users';

  /**
   * Fetches a paginated list of users.
   */
  public getUsers(pageNumber = 1, pageSize = 10): Observable<PaginatedUsers> {
    return this.http.get<PaginatedUsers>(`${this.baseUrl}?pageNumber=${pageNumber}&pageSize=${pageSize}`);
  }

  /**
   * Fetches a single user by ID.
   */
  public getUserById(id: string): Observable<UserDetail> {
    return this.http.get<UserDetail>(`${this.baseUrl}/${id}`);
  }

  /**
   * Updates an existing user profile.
   * Requires RowVersion (xmin) in the If-Match header for concurrency safety.
   */
  public updateUser(id: string, user: Partial<User>, rowVersion: number): Observable<void> {
    const headers = new HttpHeaders().set('If-Match', `"${rowVersion}"`);
    return this.http.put<void>(`${this.baseUrl}/${id}`, user, { headers });
  }

  /**
   * Approves a pending user account.
   * Requires RowVersion (xmin) in the If-Match header for concurrency safety.
   */
  public approveUser(id: string, rowVersion: number): Observable<void> {
    const headers = new HttpHeaders().set('If-Match', `"${rowVersion}"`);
    return this.http.post<void>(`${this.baseUrl}/${id}/approve`, {}, { headers });
  }
}
