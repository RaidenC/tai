import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable, map } from 'rxjs';
import { DisabilityClaimDraft } from '../+state/claim.models';
import { environment } from '../../../environments/environment';

const POC_USER_ID = 'borrower-poc-user';
const POC_CLAIM_ID = 'current';

@Injectable({ providedIn: 'root' })
export class ClaimDraftService {
  private http = inject(HttpClient);
  private headers = new HttpHeaders({ 'X-User-Id': POC_USER_ID });

  saveDraft(draft: DisabilityClaimDraft): Observable<void> {
    const jsonString = JSON.stringify(draft);
    const encryptedPayload = btoa(String.fromCharCode(...new TextEncoder().encode(jsonString)));
    return this.http.patch<void>(
      `${environment.apiBaseUrl}/claims/draft`,
      { claimId: POC_CLAIM_ID, encryptedPayload, ttlHours: 24 },
      { headers: this.headers, withCredentials: true }
    );
  }

  loadDraft(): Observable<DisabilityClaimDraft> {
    return this.http.get<{ encryptedPayload: string }>(
      `${environment.apiBaseUrl}/claims/draft/${POC_CLAIM_ID}`,
      { headers: this.headers, withCredentials: true }
    ).pipe(
      map(response => {
        const bytes = Uint8Array.from(atob(response.encryptedPayload), c => c.charCodeAt(0));
        return JSON.parse(new TextDecoder().decode(bytes)) as DisabilityClaimDraft;
      })
    );
  }
}
