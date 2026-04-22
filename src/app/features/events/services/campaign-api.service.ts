import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders, HttpParams } from '@angular/common/http';
import { Observable, throwError } from 'rxjs';
import { tap, catchError } from 'rxjs/operators';
import { environment } from '../../../../environments/environment';

// ══════════════════════════════════════════════════════════════════════════════
// INTERFACES
// ══════════════════════════════════════════════════════════════════════════════

export interface Campaign {
  id: number;
  title: string;
  description: string;
  startDate: string;
  endDate: string;
  imageUrl?: string;
  targetAudience?: string;
  visibility: 'PUBLIC' | 'SHARED' | 'PRIVATE';
  status: 'PLANNED' | 'ACTIVE' | 'FINISHED' | 'CANCELLED';
  maxParticipants?: number;
  currentParticipants: number;
  views: number;
  featured: boolean;
  createdAt: string;
  ownerClubId?: number;
  ownerClubName?: string;
  events?: any[];
  canAddEvent?: boolean; // ✅ calculé par le backend selon visibilité + permissions
}

export interface CampaignRequest {
  title: string;
  description: string;
  targetAudience?: string;
  startDate: string;
  endDate: string;
  visibility?: 'PUBLIC' | 'SHARED' | 'PRIVATE';
  maxParticipants?: number;
  status?: 'PLANNED' | 'ACTIVE' | 'FINISHED' | 'CANCELLED';
  imageUrl?: string;
  featured: boolean;
}

export interface Participant {
  id: number;
  name: string;
  email: string;
  profilePicture?: string;
  registrationDate: string;
}

export type CampaignPermission = 'VIEW' | 'ADD_EVENT' | 'MANAGE';

export interface CampaignAccess {
  id: number;
  campaignId: number;
  clubId: number;
  clubName?: string;
  permissions: CampaignPermission[];
}

export interface Event {
  id: number;
  title: string;
  description: string;
  startDate: string;
  endDate: string;
  capacity: number;
  currentParticipants: number;
  status: 'PLANNED' | 'ACTIVE' | 'FINISHED' | 'CANCELLED';
  category: string;
  clubId: number;
  clubName?: string;
  imageUrl?: string;
}

// ══════════════════════════════════════════════════════════════════════════════
// SERVICE
// ══════════════════════════════════════════════════════════════════════════════

@Injectable({ providedIn: 'root' })
export class CampaignApiService {
  private apiUrl = `${environment.apiUrl}/api/campaigns`;

  constructor(private http: HttpClient) {}

  private getHeaders(): HttpHeaders {
    const token = localStorage.getItem('token');
    return new HttpHeaders({
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    });
  }

  private getAuthHeaders(): HttpHeaders {
    const token = localStorage.getItem('token');
    return new HttpHeaders({ 'Authorization': `Bearer ${token}` });
  }

  // ── GET ALL — le backend filtre selon les droits du club connecté
  getAllCampaigns(): Observable<Campaign[]> {
    return this.http.get<Campaign[]>(this.apiUrl, { headers: this.getHeaders() }).pipe(
      tap(r => console.log('Campaigns fetched:', r.length)),
      catchError(err => { console.error('Error fetching campaigns:', err); return throwError(() => err); })
    );
  }

  // ── GET BY ID
  getCampaignById(id: number): Observable<Campaign> {
    return this.http.get<Campaign>(`${this.apiUrl}/${id}`, { headers: this.getHeaders() }).pipe(
      tap(r => console.log('Campaign fetched:', r)),
      catchError(err => { console.error('Error fetching campaign:', err); return throwError(() => err); })
    );
  }

  // ── RECORD VIEW
  recordCampaignView(id: number): Observable<Campaign> {
    return this.http.post<Campaign>(`${this.apiUrl}/${id}/views`, {}, { headers: this.getHeaders() }).pipe(
      catchError(err => { console.error('Error recording view:', err); return throwError(() => err); })
    );
  }

  // ── CREATE
  createCampaign(campaign: any, imageFile?: File | null): Observable<Campaign> {
    const formData = new FormData();
    const textFields = ['title', 'description', 'targetAudience', 'visibility',
                        'startDate', 'endDate', 'maxParticipants', 'featured'];
    textFields.forEach(key => {
      if (campaign[key] != null && campaign[key] !== '') {
        formData.append(key, String(campaign[key]));
      }
    });
    if (imageFile) formData.append('imageFile', imageFile, imageFile.name);

    return this.http.post<Campaign>(this.apiUrl, formData, { headers: this.getAuthHeaders() }).pipe(
      tap(r => console.log('[Campaign] Created:', r)),
      catchError(err => { console.error('[Campaign] Create error:', err); return throwError(() => err); })
    );
  }

  // ── UPDATE
  updateCampaign(id: number, campaign: any, imageFile?: File | null): Observable<Campaign> {
    const formData = new FormData();
    const textFields = ['title', 'description', 'targetAudience', 'visibility',
                        'startDate', 'endDate', 'maxParticipants', 'featured'];
    textFields.forEach(key => {
      if (campaign[key] != null && campaign[key] !== '') {
        formData.append(key, String(campaign[key]));
      }
    });
    if (imageFile) formData.append('imageFile', imageFile, imageFile.name);

    return this.http.put<Campaign>(`${this.apiUrl}/${id}`, formData, { headers: this.getAuthHeaders() }).pipe(
      tap(r => console.log('[Campaign] Updated:', r)),
      catchError(err => { console.error('[Campaign] Update error:', err); return throwError(() => err); })
    );
  }

  // ── DELETE
  deleteCampaign(id: number): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/${id}`, { headers: this.getHeaders() }).pipe(
      catchError(err => { console.error('Error deleting campaign:', err); return throwError(() => err); })
    );
  }

  // ── UPDATE STATUS
  updateCampaignStatus(id: number, status: string): Observable<Campaign> {
    return this.http.put<Campaign>(`${this.apiUrl}/${id}`, { status }, { headers: this.getHeaders() }).pipe(
      catchError(err => { console.error('Error updating status:', err); return throwError(() => err); })
    );
  }

  // ── PARTICIPANTS
  getCampaignParticipants(campaignId: number): Observable<Participant[]> {
    return this.http.get<Participant[]>(`${this.apiUrl}/${campaignId}/participants`, { headers: this.getHeaders() }).pipe(
      catchError(err => { console.error('Error fetching participants:', err); return throwError(() => err); })
    );
  }

  registerForCampaign(campaignId: number): Observable<void> {
    return this.http.post<void>(`${this.apiUrl}/${campaignId}/register`, {}, { headers: this.getHeaders() }).pipe(
      catchError(err => { console.error('Error registering:', err); return throwError(() => err); })
    );
  }

  unregisterFromCampaign(campaignId: number): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/${campaignId}/register`, { headers: this.getHeaders() }).pipe(
      catchError(err => { console.error('Error unregistering:', err); return throwError(() => err); })
    );
  }

  isUserRegistered(campaignId: number): Observable<boolean> {
    return this.http.get<boolean>(`${this.apiUrl}/${campaignId}/is-registered`, { headers: this.getHeaders() }).pipe(
      catchError(err => { console.error('Error checking registration:', err); return throwError(() => err); })
    );
  }

  // ── FILTERS
  getCampaignsByStatus(status: string): Observable<Campaign[]> {
    const params = new HttpParams().set('status', status);
    return this.http.get<Campaign[]>(this.apiUrl, { headers: this.getHeaders(), params }).pipe(
      catchError(err => throwError(() => err))
    );
  }

  getFeaturedCampaigns(): Observable<Campaign[]> {
    return this.http.get<Campaign[]>(`${this.apiUrl}/featured`, { headers: this.getHeaders() }).pipe(
      catchError(err => throwError(() => err))
    );
  }

  searchCampaigns(query: string): Observable<Campaign[]> {
    const params = new HttpParams().set('search', query);
    return this.http.get<Campaign[]>(this.apiUrl, { headers: this.getHeaders(), params }).pipe(
      catchError(err => throwError(() => err))
    );
  }

  // ── PERMISSIONS
  getCampaignPermissions(campaignId: number): Observable<CampaignAccess[]> {
    return this.http.get<CampaignAccess[]>(`${this.apiUrl}/${campaignId}/permissions`, { headers: this.getHeaders() }).pipe(
      catchError(err => throwError(() => err))
    );
  }

  grantPermission(campaignId: number, clubId: number, permission: CampaignPermission): Observable<CampaignAccess> {
    const params = new HttpParams().set('permission', permission);
    return this.http.post<CampaignAccess>(`${this.apiUrl}/${campaignId}/permissions/${clubId}`, {}, { headers: this.getHeaders(), params }).pipe(
      catchError(err => throwError(() => err))
    );
  }

  revokePermission(campaignId: number, clubId: number, permission: CampaignPermission): Observable<void> {
    const params = new HttpParams().set('permission', permission);
    return this.http.delete<void>(`${this.apiUrl}/${campaignId}/permissions/${clubId}`, { headers: this.getHeaders(), params }).pipe(
      catchError(err => throwError(() => err))
    );
  }

  // ── CAMPAIGN EVENTS
  getCampaignEvents(campaignId: number): Observable<Event[]> {
    return this.http.get<Event[]>(`${this.apiUrl}/${campaignId}/events`, { headers: this.getHeaders() }).pipe(
      tap(r => console.log('Campaign events fetched:', r)),
      catchError(err => throwError(() => err))
    );
  }

  assignEventToCampaign(campaignId: number, eventId: number): Observable<Event> {
    return this.http.post<Event>(`${this.apiUrl}/${campaignId}/events/${eventId}`, {}, { headers: this.getHeaders() }).pipe(
      catchError(err => throwError(() => err))
    );
  }

  removeEventFromCampaign(campaignId: number, eventId: number): Observable<Event> {
    return this.http.delete<Event>(`${this.apiUrl}/${campaignId}/events/${eventId}`, { headers: this.getHeaders() }).pipe(
      catchError(err => throwError(() => err))
    );
  }
}