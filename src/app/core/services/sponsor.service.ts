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

export type SponsorEmailDirection = 'OUTBOUND' | 'REPLY' | 'INBOUND';

export interface SponsorEmailAttachment {
  id: number;
  originalFileName: string;
  contentType: string;
  sizeBytes: number;
  fileUrl: string;
}

export interface SponsorEmail {
  id: number;
  subject: string;
  body: string;
  sentAt: string;
  direction: SponsorEmailDirection;
  inReplyToId?: number | null;
  pinned?: boolean;
  fromAddress?: string | null;
  toAddress?: string | null;
  externalMessageId?: string | null;
  threadId?: string | null;
  inReplyToMessageId?: string | null;
  attachments?: SponsorEmailAttachment[];
}

export interface SendSponsorEmailRequest {
  subject: string;
  body: string;
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

  getEmails(sponsorId: number): Observable<SponsorEmail[]> {
    return this.http.get<SponsorEmail[]>(`${this.baseUrl}/${sponsorId}/emails`);
  }

  getEmail(sponsorId: number, emailId: number): Observable<SponsorEmail> {
    return this.http.get<SponsorEmail>(`${this.baseUrl}/${sponsorId}/emails/${emailId}`);
  }

  sendEmail(sponsorId: number, payload: SendSponsorEmailRequest): Observable<SponsorEmail> {
    return this.http.post<SponsorEmail>(`${this.baseUrl}/${sponsorId}/emails`, payload);
  }

  sendEmailWithFiles(sponsorId: number, payload: SendSponsorEmailRequest, files: File[]): Observable<SponsorEmail> {
    const formData = new FormData();
    formData.append('subject', payload.subject);
    formData.append('body', payload.body);
    files.forEach(file => formData.append('files', file));
    return this.http.post<SponsorEmail>(`${this.baseUrl}/${sponsorId}/emails/with-files`, formData);
  }

  replyEmail(sponsorId: number, emailId: number, payload: SendSponsorEmailRequest): Observable<SponsorEmail> {
    return this.http.post<SponsorEmail>(`${this.baseUrl}/${sponsorId}/emails/${emailId}/reply`, payload);
  }

  replyEmailWithFiles(sponsorId: number, emailId: number, payload: SendSponsorEmailRequest, files: File[]): Observable<SponsorEmail> {
    const formData = new FormData();
    formData.append('subject', payload.subject);
    formData.append('body', payload.body);
    files.forEach(file => formData.append('files', file));
    return this.http.post<SponsorEmail>(`${this.baseUrl}/${sponsorId}/emails/${emailId}/reply-with-files`, formData);
  }

  pinEmail(sponsorId: number, emailId: number): Observable<SponsorEmail> {
    return this.http.post<SponsorEmail>(`${this.baseUrl}/${sponsorId}/emails/${emailId}/pin`, {});
  }

  unpinEmail(sponsorId: number, emailId: number): Observable<SponsorEmail> {
    return this.http.post<SponsorEmail>(`${this.baseUrl}/${sponsorId}/emails/${emailId}/unpin`, {});
  }

  syncInboundEmails(): Observable<SponsorEmail[]> {
    return this.http.post<SponsorEmail[]>(`${this.baseUrl}/emails/sync-inbound`, {});
  }
}
