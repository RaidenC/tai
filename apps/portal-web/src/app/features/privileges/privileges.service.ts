import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';

export enum RiskLevel {
  Low = 0,
  Medium = 1,
  High = 2,
  Critical = 3
}

export interface JitSettings {
  expiry: string | null;
  allowGuest: boolean;
  requireMfa: boolean;
}

export interface Privilege {
  id: string;
  name: string;
  description: string;
  module: string;
  riskLevel: RiskLevel;
  isActive: boolean;
  rowVersion: string;
  jitSettings: JitSettings;
}

export interface PaginatedList<T> {
  items: T[];
  totalCount: number;
  pageNumber: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPreviousPage: boolean;
}

@Injectable({
  providedIn: 'root'
})
export class PrivilegesService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = '/api/privileges';

  getPrivileges(page: number, size: number, search?: string): Observable<PaginatedList<Privilege>> {
    let params = new HttpParams()
      .set('pageNumber', page.toString())
      .set('pageSize', size.toString());

    if (search) {
      params = params.set('search', search);
    }

    return this.http.get<PaginatedList<Privilege>>(this.apiUrl, { params });
  }

  getPrivilegeById(id: string): Observable<Privilege> {
    return this.http.get<Privilege>(`${this.apiUrl}/${id}`);
  }

  updatePrivilege(id: string, privilege: Partial<Privilege>, isStepUpVerified = false): Observable<Privilege> {
    let headers = {};
    if (isStepUpVerified) {
      headers = { 'X-Step-Up-Verified': 'true' };
    }
    return this.http.put<Privilege>(`${this.apiUrl}/${id}`, privilege, { headers });
  }
}
