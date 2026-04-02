import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment.development';

export type SponsorStatus = 'PENDING' | 'CONFIRMED' | 'DENIED';

export interface Sponsor {
  id?: number;
  name: string;
  contactEmail: string;
  phone: string;
  logoUrl?: string | null;
  joinDate?: string | null;
  status?: SponsorStatus;
  confirmationToken?: string | null;
  tokenExpiresAt?: string | null;
}

export interface CreateSponsorRequest {
  name: string;
  contactEmail: string;
  phone: string;
  logoUrl?: string | null;
  joinDate?: string | null;
}

export interface UpdateSponsorRequest {
  id: number;
  name: string;
  contactEmail: string;
  phone: string;
  logoUrl?: string | null;
  joinDate?: string | null;
  status?: SponsorStatus;
  confirmationToken?: string | null;
  tokenExpiresAt?: string | null;
}

@Injectable({
  providedIn: 'root'
})
export class SponsorService {
  private readonly baseUrl = `${environment.apiUrl}/api/sponsors`;

  constructor(private http: HttpClient) {}

  getAll(): Observable<Sponsor[]> {
    return this.http.get<Sponsor[]>(this.baseUrl);
  }

  create(payload: CreateSponsorRequest): Observable<Sponsor> {
    return this.http.post<Sponsor>(this.baseUrl, payload);
  }

  update(payload: UpdateSponsorRequest): Observable<Sponsor> {
    return this.http.put<Sponsor>(`${this.baseUrl}/${payload.id}`, payload);
  }

  delete(id: number, reason: string): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl}/${id}?reason=${encodeURIComponent(reason)}`);
  }

  uploadLogo(id: number, file: File): Observable<Sponsor> {
    const formData = new FormData();
    formData.append('file', file);
    return this.http.post<Sponsor>(`${this.baseUrl}/${id}/logo`, formData);
  }
}
