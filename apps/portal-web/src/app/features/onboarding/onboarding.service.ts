import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

export interface RegistrationRequest {
  email: string;
  firstName: string;
  lastName: string;
  password?: string; // Optional for admin creation, required for self-service
}

export interface PendingUser {
  id: string;
  email: string;
  name: string;
}

/**
 * OnboardingService
 * 
 * Persona: Backend Integration Architect.
 * Context: Secure communication with the Onboarding Minimal API.
 * 
 * Features:
 * 1. Typed interfaces for registration, verification, and approvals.
 * 2. Centralized API routing for the onboarding track.
 * 3. DPoP-signed requests (handled automatically by dpopInterceptor).
 */
@Injectable({
  providedIn: 'root',
})
export class OnboardingService {
  private readonly http = inject(HttpClient);
  
  private readonly baseUrl = '/api/onboarding';

  /**
   * Registers a new customer (Self-service).
   */
  public register(request: RegistrationRequest): Observable<any> {
    return this.http.post(`${this.baseUrl}/register`, request);
  }

  /**
   * Verifies the 6-digit OTP for a user.
   */
  public verifyOtp(code: string): Observable<any> {
    return this.http.post(`${this.baseUrl}/verify`, { code });
  }

  /**
   * Fetches the list of users awaiting approval (Tenant Admin).
   */
  public getPendingApprovals(): Observable<PendingUser[]> {
    return this.http.get<PendingUser[]>(`${this.baseUrl}/pending`);
  }

  /**
   * Approves a pending staff/admin account.
   */
  public approveUser(userId: string): Observable<any> {
    return this.http.post(`${this.baseUrl}/approve`, { userId });
  }
}
