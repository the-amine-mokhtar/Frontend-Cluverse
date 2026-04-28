import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment.development';

export type SponsorshipStatus =
  | 'PROSPECTING'
  | 'OUTREACH_SENT'
  | 'CONTRACT_SENT'
  | 'SIGNED'
  | 'PAID';

export interface Sponsorship {
  id: number;
  sponsorId: number;
  sponsorName: string;
  sponsorLogoUrl?: string | null;
  eventId?: number | null;
  eventName?: string | null;
  ownerName?: string | null;
  amount?: number | null;
  expectedAmount?: number | null;
  agreedAmount?: number | null;
  paidAmount?: number | null;
  proposalSummary?: string | null;
  proposalDocumentName?: string | null;
  contractDocumentName?: string | null;
  signedDocumentName?: string | null;
  contractReference?: string | null;
  notes?: string | null;
  outreachSentAt?: string | null;
  outreachDecision?: string | null;
  proposalSentAt?: string | null;
  contractSentAt?: string | null;
  signedAt?: string | null;
  paidAt?: string | null;
  createdAt?: string | null;
  updatedAt?: string | null;
  status: SponsorshipStatus;
}

export interface CreateSponsorshipRequest {
  sponsorId: number;
  eventName?: string | null;
  expectedAmount?: number | null;
  proposalSummary?: string | null;
  notes?: string | null;
}

export interface UpdateSponsorshipRequest {
  eventName?: string | null;
  expectedAmount?: number | null;
  agreedAmount?: number | null;
  paidAmount?: number | null;
  proposalSummary?: string | null;
  proposalDocumentName?: string | null;
  contractDocumentName?: string | null;
  signedDocumentName?: string | null;
  contractReference?: string | null;
  notes?: string | null;
}

export interface GenerateSponsorshipProposalSummaryRequest {
  sponsorName: string;
  eventName: string;
  expectedAmount: number;
}

export interface GenerateSponsorshipProposalSummaryResponse {
  summary: string;
  model: string;
}

@Injectable({
  providedIn: 'root'
})
export class SponsorshipService {
  private readonly baseUrl = `${environment.apiUrl}/api/sponsorships`;

  constructor(private http: HttpClient) {}

  private authHeaders(): HttpHeaders {
    const token = localStorage.getItem('token') ?? '';
    return new HttpHeaders({ Authorization: `Bearer ${token}` });
  }

  getAll(): Observable<Sponsorship[]> {
    return this.http.get<Sponsorship[]>(this.baseUrl, { headers: this.authHeaders() });
  }

  create(payload: CreateSponsorshipRequest): Observable<Sponsorship> {
    return this.http.post<Sponsorship>(this.baseUrl, payload, { headers: this.authHeaders() });
  }

  update(id: number, payload: UpdateSponsorshipRequest): Observable<Sponsorship> {
    return this.http.put<Sponsorship>(`${this.baseUrl}/${id}`, payload, { headers: this.authHeaders() });
  }

  move(id: number, toStatus: SponsorshipStatus): Observable<Sponsorship> {
    return this.http.post<Sponsorship>(`${this.baseUrl}/${id}/move`, { toStatus }, { headers: this.authHeaders() });
  }

  triggerReplySync(): Observable<void> {
    return this.http.post<void>(`${this.baseUrl}/sync-replies`, {}, { headers: this.authHeaders() });
  }

  delete(id: number): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl}/${id}`, { headers: this.authHeaders() });
  }

  generateProposalSummaryWithAi(payload: GenerateSponsorshipProposalSummaryRequest): Observable<GenerateSponsorshipProposalSummaryResponse> {
    return this.http.post<GenerateSponsorshipProposalSummaryResponse>(
      `${environment.apiUrl}/api/ai/summary/sponsorship-proposal`,
      payload,
      { headers: this.authHeaders() }
    );
  }
}
