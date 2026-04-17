import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { DisabilityClaimDraft } from '../+state/claim.models';

@Injectable({ providedIn: 'root' })
export class ClaimDraftService {
  constructor(private http: HttpClient) {}

  saveDraft(draft: DisabilityClaimDraft): Observable<void> {
    return this.http.patch<void>('/api/claims/draft', draft);
  }

  loadDraft(): Observable<DisabilityClaimDraft> {
    return this.http.get<DisabilityClaimDraft>('/api/claims/draft');
  }
}
